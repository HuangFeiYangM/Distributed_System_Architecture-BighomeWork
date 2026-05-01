package com.canteen.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.constant.RoleNames;
import com.canteen.common.constant.UserHeaders;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.Result;
import com.canteen.common.result.StatusCode;
import com.canteen.order.client.MenuClient;
import com.canteen.order.client.PickupClient;
import com.canteen.order.client.dto.EnqueueRequest;
import com.canteen.order.client.dto.EnqueueResultVO;
import com.canteen.order.client.dto.MenuDishRemoteVO;
import com.canteen.order.client.dto.MenuStockOpDTO;
import com.canteen.order.constant.OrderStatus;
import com.canteen.order.dto.CreateOrderDTO;
import com.canteen.order.dto.OrderBatchStatusDTO;
import com.canteen.order.entity.CanteenOrder;
import com.canteen.order.entity.OrderItem;
import com.canteen.order.mapper.OrderItemMapper;
import com.canteen.order.mapper.OrderMapper;
import com.canteen.order.vo.OrderBriefVO;
import com.canteen.order.vo.OrderVO;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class OrdersAppService {

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final MenuClient menuClient;
    private final PickupClient pickupClient;
    private final OrderPersistenceFacade orderPersistenceFacade;

    public CanteenOrder create(HttpServletRequest request, CreateOrderDTO dto) {
        Long userId = Long.parseLong(request.getHeader(UserHeaders.USER_ID));

        List<MenuStockOpDTO> rolledBack = new ArrayList<>();
        List<OrderItem> pendingItems = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        try {
            for (CreateOrderDTO.OrderLineDTO line : dto.getItems()) {
                Result<MenuDishRemoteVO> mdRes = menuClient.getMenuDish(line.getMenuDishId());
                if (mdRes == null || !mdRes.isSuccess() || mdRes.getData() == null) {
                    throw new BusinessException(StatusCode.MENU_NOT_FOUND);
                }
                MenuDishRemoteVO md = mdRes.getData();
                Result<Boolean> deductRes = menuClient.deduct(new MenuStockOpDTO(line.getMenuDishId(), line.getQuantity()));
                if (deductRes == null || !Boolean.TRUE.equals(deductRes.getData())) {
                    throw new BusinessException(StatusCode.STOCK_NOT_ENOUGH);
                }
                rolledBack.add(new MenuStockOpDTO(line.getMenuDishId(), line.getQuantity()));

                BigDecimal unit = md.getSalePrice();
                BigDecimal sub = unit.multiply(BigDecimal.valueOf(line.getQuantity()));
                total = total.add(sub);

                OrderItem oi = new OrderItem();
                oi.setDishId(md.getDishId());
                oi.setMenuDishId(md.getId());
                oi.setDishName(md.getDishName());
                oi.setQuantity(line.getQuantity());
                oi.setUnitPrice(unit);
                oi.setSubtotal(sub);
                pendingItems.add(oi);
            }

            LocalDateTime now = LocalDateTime.now();
            CanteenOrder order = new CanteenOrder();
            order.setOrderNo(genOrderNo());
            order.setUserId(userId);
            order.setWindowId(dto.getWindowId());
            order.setTotalAmount(total);
            order.setStatus(OrderStatus.PLACED);
            order.setPickupCode(genPickupCode());
            order.setRemark(dto.getRemark());
            order.setPayDeadline(now.plusMinutes(15));
            order.setAcceptDeadline(now.plusMinutes(30));

            return orderPersistenceFacade.persistOrderAndItems(order, pendingItems);
        } catch (BusinessException e) {
            restoreStocks(rolledBack);
            throw e;
        } catch (RuntimeException e) {
            restoreStocks(rolledBack);
            throw e;
        }
    }

    private void restoreStocks(List<MenuStockOpDTO> rolledBack) {
        for (int i = rolledBack.size() - 1; i >= 0; i--) {
            MenuStockOpDTO op = rolledBack.get(i);
            menuClient.restore(op);
        }
    }

    private String genOrderNo() {
        String day = DateTimeFormatter.ofPattern("yyyyMMdd").format(LocalDateTime.now());
        return "O" + day + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private String genPickupCode() {
        for (int i = 0; i < 15; i++) {
            int code = ThreadLocalRandom.current().nextInt(100000, 1000000);
            String s = String.valueOf(code);
            Long c = orderMapper.selectCount(new LambdaQueryWrapper<CanteenOrder>().eq(CanteenOrder::getPickupCode, s));
            if (c == null || c == 0) {
                return s;
            }
        }
        throw new BusinessException(StatusCode.ERROR);
    }

    public OrderVO detail(HttpServletRequest request, Long id) {
        Long uid = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        String role = request.getHeader(UserHeaders.ROLE);
        CanteenOrder o = orderMapper.selectById(id);
        if (o == null) {
            throw new BusinessException(StatusCode.ORDER_NOT_FOUND);
        }
        if (!RoleNames.ADMIN.equals(role) && !uid.equals(o.getUserId())) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        return toVo(o);
    }

    public Page<OrderVO> myOrders(HttpServletRequest request, long page, long size) {
        Long uid = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        Page<CanteenOrder> p = orderMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<CanteenOrder>().eq(CanteenOrder::getUserId, uid).orderByDesc(CanteenOrder::getId));
        Page<OrderVO> out = new Page<>(p.getCurrent(), p.getSize(), p.getTotal());
        out.setRecords(p.getRecords().stream().map(this::toVo).toList());
        return out;
    }

    public Page<OrderVO> merchantOrders(HttpServletRequest request, long page, long size, Integer status, Long windowId,
                                        String keyword, String dateFrom, String dateTo) {
        requireMerchant(request);
        Long merchantId = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        List<Long> merchantWindowIds = resolveMerchantWindowIds(merchantId);
        if (merchantWindowIds.isEmpty()) {
            return new Page<>(page, size, 0);
        }
        LambdaQueryWrapper<CanteenOrder> q = buildQuery(status, null, null, keyword, dateFrom, dateTo);
        if (windowId != null && !merchantWindowIds.contains(windowId)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        q.in(CanteenOrder::getWindowId, windowId == null ? merchantWindowIds : List.of(windowId));
        return queryPage(page, size, q);
    }

    public Page<OrderVO> adminOrders(HttpServletRequest request, long page, long size, Integer status, Long merchantId,
                                     Long windowId, Long userId, String keyword, String dateFrom, String dateTo) {
        requireAdmin(request);
        LambdaQueryWrapper<CanteenOrder> q = buildQuery(status, windowId, userId, keyword, dateFrom, dateTo);
        if (merchantId != null && windowId == null) {
            List<Long> windowIds = resolveMerchantWindowIds(merchantId);
            if (windowIds.isEmpty()) {
                return new Page<>(page, size, 0);
            }
            q.in(CanteenOrder::getWindowId, windowIds);
        }
        return queryPage(page, size, q);
    }

    public OrderBriefVO findByPickupCode(String code) {
        CanteenOrder o = orderMapper.selectOne(new LambdaQueryWrapper<CanteenOrder>().eq(CanteenOrder::getPickupCode, code));
        if (o == null) {
            return null;
        }
        return OrderBriefVO.builder()
                .id(o.getId())
                .userId(o.getUserId())
                .windowId(o.getWindowId())
                .status(o.getStatus())
                .pickupCode(o.getPickupCode())
                .pickupNo(o.getPickupNo())
                .build();
    }

    public OrderBriefVO requireByPickupCode(String code) {
        OrderBriefVO vo = findByPickupCode(code);
        if (vo == null) {
            throw new BusinessException(StatusCode.ORDER_NOT_FOUND);
        }
        return vo;
    }

    @Transactional
    public void pickupCallback(Long orderId) {
        CanteenOrder o = orderMapper.selectById(orderId);
        if (o == null) {
            throw new BusinessException(StatusCode.ORDER_NOT_FOUND);
        }
        if (o.getStatus() != OrderStatus.READY) {
            throw new BusinessException(StatusCode.ORDER_STATUS_ERROR);
        }
        o.setStatus(OrderStatus.PICKED);
        orderMapper.updateById(o);
    }

    @Transactional
    public void accept(HttpServletRequest request, Long id) {
        requireMerchant(request);
        CanteenOrder o = loadOrder(id);
        if (o.getStatus() != OrderStatus.PLACED) {
            throw new BusinessException(StatusCode.ORDER_STATUS_ERROR);
        }
        o.setStatus(OrderStatus.ACCEPTED);
        orderMapper.updateById(o);
    }

    @Transactional
    public void cook(HttpServletRequest request, Long id) {
        requireMerchant(request);
        CanteenOrder o = loadOrder(id);
        if (o.getStatus() != OrderStatus.ACCEPTED) {
            throw new BusinessException(StatusCode.ORDER_STATUS_ERROR);
        }
        o.setStatus(OrderStatus.COOKING);
        orderMapper.updateById(o);
    }

    @Transactional
    public void ready(HttpServletRequest request, Long id) {
        requireMerchant(request);
        CanteenOrder o = loadOrder(id);
        if (o.getStatus() != OrderStatus.COOKING) {
            throw new BusinessException(StatusCode.ORDER_STATUS_ERROR);
        }
        o.setStatus(OrderStatus.READY);
        orderMapper.updateById(o);

        Result<EnqueueResultVO> res = pickupClient.enqueue(new EnqueueRequest(o.getId(), o.getWindowId()));
        if (res == null || !res.isSuccess() || res.getData() == null) {
            throw new BusinessException(StatusCode.ERROR);
        }
        o.setPickupNo(res.getData().getPickupNo());
        orderMapper.updateById(o);
    }

    @Transactional
    public void userCancel(HttpServletRequest request, Long id) {
        Long uid = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        CanteenOrder o = loadOrder(id);
        if (!uid.equals(o.getUserId())) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        if (o.getStatus() != OrderStatus.PLACED) {
            throw new BusinessException(StatusCode.ORDER_STATUS_ERROR);
        }
        cancelOrder(o, 1);
    }

    @Transactional
    public void timeoutCancelBatch() {
        LocalDateTime now = LocalDateTime.now();
        List<CanteenOrder> list = orderMapper.selectList(new LambdaQueryWrapper<CanteenOrder>()
                .eq(CanteenOrder::getStatus, OrderStatus.PLACED)
                .and(w -> w.lt(CanteenOrder::getPayDeadline, now).or().lt(CanteenOrder::getAcceptDeadline, now))
                .last("LIMIT 100"));
        for (CanteenOrder o : list) {
            cancelOrder(o, 2);
        }
    }

    @Transactional
    public void remark(HttpServletRequest request, Long id, String remark) {
        requireMerchant(request);
        CanteenOrder o = loadOrder(id);
        o.setRemark(remark);
        orderMapper.updateById(o);
    }

    @Transactional
    public void batchStatus(HttpServletRequest request, OrderBatchStatusDTO dto) {
        requireMerchant(request);
        if (dto == null || dto.getOrderIds() == null || dto.getOrderIds().isEmpty() || dto.getStatus() == null) {
            throw new BusinessException(StatusCode.PARAM_ERROR);
        }
        for (Long orderId : dto.getOrderIds()) {
            CanteenOrder o = loadOrder(orderId);
            o.setStatus(dto.getStatus());
            orderMapper.updateById(o);
        }
    }

    public Map<String, Object> merchantDashboard(HttpServletRequest request) {
        requireMerchant(request);
        Long uid = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        Map<String, Object> out = new HashMap<>();
        out.put("totalOrders", countByFilter(uid, null));
        out.put("placedOrders", countByFilter(uid, OrderStatus.PLACED));
        out.put("readyOrders", countByFilter(uid, OrderStatus.READY));
        out.put("doneOrders", countByFilter(uid, OrderStatus.PICKED));
        return out;
    }

    public Map<String, Object> adminDashboard(HttpServletRequest request) {
        requireAdmin(request);
        Map<String, Object> out = new HashMap<>();
        out.put("totalOrders", orderMapper.selectCount(new LambdaQueryWrapper<>()));
        out.put("placedOrders", orderMapper.selectCount(new LambdaQueryWrapper<CanteenOrder>().eq(CanteenOrder::getStatus, OrderStatus.PLACED)));
        out.put("readyOrders", orderMapper.selectCount(new LambdaQueryWrapper<CanteenOrder>().eq(CanteenOrder::getStatus, OrderStatus.READY)));
        out.put("doneOrders", orderMapper.selectCount(new LambdaQueryWrapper<CanteenOrder>().eq(CanteenOrder::getStatus, OrderStatus.PICKED)));
        return out;
    }

    private void cancelOrder(CanteenOrder o, int cancelType) {
        o.setStatus(OrderStatus.CANCELLED);
        o.setCancelType(cancelType);
        o.setCancelTime(LocalDateTime.now());
        orderMapper.updateById(o);

        List<OrderItem> items = orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, o.getId()));
        for (OrderItem it : items) {
            if (it.getMenuDishId() != null) {
                menuClient.restore(new MenuStockOpDTO(it.getMenuDishId(), it.getQuantity()));
            }
        }
    }

    private CanteenOrder loadOrder(Long id) {
        CanteenOrder o = orderMapper.selectById(id);
        if (o == null) {
            throw new BusinessException(StatusCode.ORDER_NOT_FOUND);
        }
        return o;
    }

    private OrderVO toVo(CanteenOrder o) {
        List<OrderItem> items = orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, o.getId()));
        List<OrderVO.OrderItemVO> iv = items.stream()
                .map(it -> OrderVO.OrderItemVO.builder()
                        .dishId(it.getDishId())
                        .menuDishId(it.getMenuDishId())
                        .dishName(it.getDishName())
                        .quantity(it.getQuantity())
                        .unitPrice(it.getUnitPrice())
                        .subtotal(it.getSubtotal())
                        .build())
                .toList();
        return OrderVO.builder()
                .id(o.getId())
                .orderNo(o.getOrderNo())
                .userId(o.getUserId())
                .windowId(o.getWindowId())
                .totalAmount(o.getTotalAmount())
                .status(o.getStatus())
                .pickupNo(o.getPickupNo())
                .pickupCode(o.getPickupCode())
                .remark(o.getRemark())
                .payDeadline(o.getPayDeadline())
                .acceptDeadline(o.getAcceptDeadline())
                .createTime(o.getCreateTime())
                .items(iv)
                .build();
    }

    private Page<OrderVO> queryPage(long page, long size, LambdaQueryWrapper<CanteenOrder> q) {
        Page<CanteenOrder> p = orderMapper.selectPage(new Page<>(page, size), q.orderByDesc(CanteenOrder::getId));
        Page<OrderVO> out = new Page<>(p.getCurrent(), p.getSize(), p.getTotal());
        out.setRecords(p.getRecords().stream().map(this::toVo).toList());
        return out;
    }

    private LambdaQueryWrapper<CanteenOrder> buildQuery(Integer status, Long windowId, Long userId, String keyword,
                                                        String dateFrom, String dateTo) {
        LambdaQueryWrapper<CanteenOrder> q = new LambdaQueryWrapper<>();
        if (status != null) {
            q.eq(CanteenOrder::getStatus, status);
        }
        if (windowId != null) {
            q.eq(CanteenOrder::getWindowId, windowId);
        }
        if (userId != null) {
            q.eq(CanteenOrder::getUserId, userId);
        }
        if (dateFrom != null && !dateFrom.isBlank()) {
            q.ge(CanteenOrder::getCreateTime, parseStartTime(dateFrom));
        }
        if (dateTo != null && !dateTo.isBlank()) {
            q.le(CanteenOrder::getCreateTime, parseEndTime(dateTo));
        }
        if (keyword != null && !keyword.isBlank()) {
            String key = keyword.trim();
            Set<Long> matchedOrderIds = new HashSet<>();
            List<OrderItem> matchedItems = orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>().like(OrderItem::getDishName, key));
            for (OrderItem item : matchedItems) {
                matchedOrderIds.add(item.getOrderId());
            }
            q.and(w -> w.like(CanteenOrder::getOrderNo, key)
                    .or().like(CanteenOrder::getPickupCode, key)
                    .or().in(!matchedOrderIds.isEmpty(), CanteenOrder::getId, matchedOrderIds));
        }
        return q;
    }

    private LocalDateTime parseStartTime(String raw) {
        String input = raw.trim();
        if (input.length() <= 10) {
            return LocalDate.parse(input).atStartOfDay();
        }
        return LocalDateTime.parse(input);
    }

    private LocalDateTime parseEndTime(String raw) {
        String input = raw.trim();
        if (input.length() <= 10) {
            return LocalDate.parse(input).atTime(LocalTime.MAX);
        }
        return LocalDateTime.parse(input);
    }

    private static void requireMerchant(HttpServletRequest request) {
        String role = request.getHeader(UserHeaders.ROLE);
        if (!RoleNames.MERCHANT.equals(role) && !RoleNames.ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private static void requireAdmin(HttpServletRequest request) {
        String role = request.getHeader(UserHeaders.ROLE);
        if (!RoleNames.ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private Long countByFilter(Long merchantId, Integer status) {
        List<Long> windowIds = resolveMerchantWindowIds(merchantId);
        if (windowIds.isEmpty()) {
            return 0L;
        }
        LambdaQueryWrapper<CanteenOrder> q = new LambdaQueryWrapper<CanteenOrder>().in(CanteenOrder::getWindowId, windowIds);
        if (status != null) {
            q.eq(CanteenOrder::getStatus, status);
        }
        return orderMapper.selectCount(q);
    }

    @SuppressWarnings("unchecked")
    private List<Long> resolveMerchantWindowIds(Long merchantId) {
        Result<Map<String, Object>> res = pickupClient.windows(1, 200, merchantId);
        if (res == null || !res.isSuccess() || res.getData() == null) {
            return List.of();
        }
        Object recordsObj = res.getData().get("records");
        if (!(recordsObj instanceof List<?> records)) {
            return List.of();
        }
        List<Long> windowIds = new ArrayList<>();
        for (Object rec : records) {
            if (rec instanceof Map<?, ?> row && row.get("id") != null) {
                Object idObj = row.get("id");
                if (idObj instanceof Number num) {
                    windowIds.add(num.longValue());
                }
            }
        }
        return windowIds;
    }
}
