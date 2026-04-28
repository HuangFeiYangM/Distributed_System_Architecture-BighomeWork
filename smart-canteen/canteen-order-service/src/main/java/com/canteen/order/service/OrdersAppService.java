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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
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

    private static void requireMerchant(HttpServletRequest request) {
        String role = request.getHeader(UserHeaders.ROLE);
        if (!RoleNames.MERCHANT.equals(role) && !RoleNames.ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }
}
