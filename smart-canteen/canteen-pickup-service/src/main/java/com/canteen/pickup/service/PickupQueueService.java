package com.canteen.pickup.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.Result;
import com.canteen.common.result.StatusCode;
import com.canteen.pickup.client.OrderRemoteClient;
import com.canteen.pickup.client.dto.OrderBriefRemoteVO;
import com.canteen.pickup.dto.EnqueueBody;
import com.canteen.pickup.dto.VerifyDTO;
import com.canteen.pickup.dto.WindowCreateDTO;
import com.canteen.pickup.entity.CanteenWindow;
import com.canteen.pickup.entity.PickupRecord;
import com.canteen.pickup.mapper.CanteenWindowMapper;
import com.canteen.pickup.mapper.PickupRecordMapper;
import com.canteen.pickup.vo.DisplayVO;
import com.canteen.pickup.vo.EnqueueResultVO;
import com.canteen.pickup.websocket.WebSocketBroadcaster;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import static com.canteen.common.constant.RoleNames.ADMIN;
import static com.canteen.common.constant.RoleNames.MERCHANT;
import static com.canteen.common.constant.UserHeaders.ROLE;

@Service
@RequiredArgsConstructor
public class PickupQueueService {

    private static final int QUEUE_WAITING = 0;
    private static final int QUEUE_CALLED = 1;
    private static final int QUEUE_PICKED = 2;

    private final StringRedisTemplate redis;
    private final CanteenWindowMapper windowMapper;
    private final PickupRecordMapper pickupRecordMapper;
    private final OrderRemoteClient orderRemoteClient;
    private final WebSocketBroadcaster broadcaster;

    public EnqueueResultVO enqueue(EnqueueBody body) {
        CanteenWindow w = windowMapper.selectById(body.getWindowId());
        if (w == null || (w.getStatus() != null && w.getStatus() == 0)) {
            throw new BusinessException(StatusCode.NOT_FOUND);
        }

        Long wid = body.getWindowId();
        Long seq = redis.opsForValue().increment("window:" + wid + ":seq");
        if (seq == null) {
            seq = 1L;
        }
        String prefix = StringUtils.hasText(w.getPickupPrefix()) ? w.getPickupPrefix() : "A";
        String pickupNo = prefix + String.format("%03d", seq % 1000);

        redis.opsForList().leftPush(queueKey(wid), String.valueOf(body.getOrderId()));

        PickupRecord pr = new PickupRecord();
        pr.setOrderId(body.getOrderId());
        pr.setWindowId(wid);
        pr.setPickupNo(pickupNo);
        pr.setQueueStatus(QUEUE_WAITING);
        pr.setQueueTime(LocalDateTime.now());
        pickupRecordMapper.insert(pr);

        return new EnqueueResultVO(pickupNo);
    }

    @Transactional
    public String call(Long windowId) {
        String oidStr = redis.opsForList().rightPop(queueKey(windowId));
        if (oidStr == null) {
            throw new BusinessException(StatusCode.QUEUE_EMPTY);
        }
        Long orderId = Long.parseLong(oidStr.trim());

        PickupRecord pr = pickupRecordMapper.selectOne(new LambdaQueryWrapper<PickupRecord>()
                .eq(PickupRecord::getOrderId, orderId)
                .eq(PickupRecord::getWindowId, windowId)
                .orderByDesc(PickupRecord::getId)
                .last("LIMIT 1"));
        if (pr != null) {
            pr.setQueueStatus(QUEUE_CALLED);
            pr.setCallTime(LocalDateTime.now());
            pickupRecordMapper.updateById(pr);
        }

        redis.opsForValue().set(currentKey(windowId), oidStr);
        if (pr != null) {
            redis.opsForList().leftPush(historyKey(windowId), pr.getPickupNo());
            redis.opsForList().trim(historyKey(windowId), 0, 19);
        }

        String pickupNo = pr != null ? pr.getPickupNo() : "";
        String json = String.format(
                "{\"type\":\"CALL\",\"windowId\":%d,\"orderId\":%d,\"pickupNo\":\"%s\"}",
                windowId, orderId, pickupNo);
        broadcastSafe(json);

        return pickupNo;
    }

    @Transactional
    public void verify(VerifyDTO dto) {
        Result<OrderBriefRemoteVO> res = orderRemoteClient.findByPickupCode(dto.getPickupCode());
        if (res == null || !res.isSuccess() || res.getData() == null) {
            throw new BusinessException(StatusCode.PICKUP_VERIFY_FAILED);
        }
        OrderBriefRemoteVO o = res.getData();
        if (!Objects.equals(o.getStatus(), 3)) {
            throw new BusinessException(StatusCode.ORDER_STATUS_ERROR);
        }

        Result<Void> done = orderRemoteClient.pickupDone(o.getId());
        if (done == null || !done.isSuccess()) {
            throw new BusinessException(StatusCode.ERROR);
        }

        PickupRecord pr = pickupRecordMapper.selectOne(new LambdaQueryWrapper<PickupRecord>()
                .eq(PickupRecord::getOrderId, o.getId())
                .orderByDesc(PickupRecord::getId)
                .last("LIMIT 1"));
        if (pr != null) {
            pr.setQueueStatus(QUEUE_PICKED);
            pr.setPickupTime(LocalDateTime.now());
            pickupRecordMapper.updateById(pr);
        }

        String json = String.format(
                "{\"type\":\"PICKED\",\"orderId\":%d,\"pickupNo\":\"%s\"}",
                o.getId(), o.getPickupNo() != null ? o.getPickupNo() : "");
        broadcastSafe(json);
    }

    private void broadcastSafe(String json) {
        try {
            broadcaster.broadcast(json);
        } catch (IOException e) {
            throw new BusinessException(StatusCode.ERROR);
        }
    }

    public List<String> queue(Long windowId) {
        List<String> range = redis.opsForList().range(queueKey(windowId), 0, -1);
        return range != null ? range : Collections.emptyList();
    }

    public DisplayVO display(Long windowId) {
        String cur = redis.opsForValue().get(currentKey(windowId));
        List<String> wait = redis.opsForList().range(queueKey(windowId), 0, -1);
        Long sz = redis.opsForList().size(queueKey(windowId));
        List<String> hist = redis.opsForList().range(historyKey(windowId), 0, 19);

        String currentPickupNo = "";
        Long currentOrderId = null;
        if (cur != null) {
            currentOrderId = Long.parseLong(cur.trim());
            PickupRecord pr = pickupRecordMapper.selectOne(new LambdaQueryWrapper<PickupRecord>()
                    .eq(PickupRecord::getOrderId, currentOrderId)
                    .eq(PickupRecord::getWindowId, windowId)
                    .orderByDesc(PickupRecord::getId)
                    .last("LIMIT 1"));
            if (pr != null) {
                currentPickupNo = pr.getPickupNo();
            }
        }

        return DisplayVO.builder()
                .windowId(windowId)
                .currentPickupNo(currentPickupNo)
                .currentOrderId(currentOrderId)
                .waitingCount(sz != null ? sz.intValue() : 0)
                .waitingOrderIds(wait != null ? wait : Collections.emptyList())
                .recentCalls(hist != null ? hist : Collections.emptyList())
                .build();
    }

    public Page<CanteenWindow> windows(long page, long size, Integer status, Long merchantId, String keyword) {
        LambdaQueryWrapper<CanteenWindow> q = new LambdaQueryWrapper<>();
        if (status != null) {
            q.eq(CanteenWindow::getStatus, status);
        }
        if (merchantId != null) {
            q.eq(CanteenWindow::getMerchantId, merchantId);
        }
        if (keyword != null && !keyword.isBlank()) {
            String key = keyword.trim();
            q.and(w -> w.like(CanteenWindow::getName, key).or().like(CanteenWindow::getLocation, key));
        }
        q.orderByAsc(CanteenWindow::getId);
        return windowMapper.selectPage(new Page<>(page, size), q);
    }

    @Transactional
    public CanteenWindow createWindow(HttpServletRequest request, WindowCreateDTO dto) {
        String role = request.getHeader(ROLE);
        if (!MERCHANT.equals(role) && !ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        CanteenWindow w = new CanteenWindow();
        w.setName(dto.getName());
        w.setLocation(dto.getLocation());
        w.setMerchantId(dto.getMerchantId());
        w.setPickupPrefix(StringUtils.hasText(dto.getPickupPrefix()) ? dto.getPickupPrefix() : "A");
        w.setStatus(1);
        windowMapper.insert(w);
        return w;
    }

    @Transactional
    public void updateWindow(HttpServletRequest request, Long id, WindowCreateDTO dto) {
        requireAdmin(request);
        CanteenWindow w = requireWindow(id);
        w.setName(dto.getName());
        w.setLocation(dto.getLocation());
        w.setMerchantId(dto.getMerchantId());
        if (StringUtils.hasText(dto.getPickupPrefix())) {
            w.setPickupPrefix(dto.getPickupPrefix());
        }
        windowMapper.updateById(w);
    }

    @Transactional
    public void updateWindowStatus(HttpServletRequest request, Long id, Integer value) {
        requireAdmin(request);
        if (value == null || (value != 0 && value != 1)) {
            throw new BusinessException(StatusCode.PARAM_ERROR);
        }
        CanteenWindow w = requireWindow(id);
        w.setStatus(value);
        windowMapper.updateById(w);
    }

    @Transactional
    public void deleteWindow(HttpServletRequest request, Long id) {
        requireAdmin(request);
        CanteenWindow w = requireWindow(id);
        Long active = pickupRecordMapper.selectCount(new LambdaQueryWrapper<PickupRecord>()
                .eq(PickupRecord::getWindowId, id)
                .in(PickupRecord::getQueueStatus, 0, 1));
        if (active != null && active > 0) {
            throw new BusinessException(StatusCode.DUPLICATE_KEY, "窗口有活动订单，不能删除");
        }
        windowMapper.deleteById(w.getId());
    }

    public List<PickupRecord> history(Long id) {
        requireWindow(id);
        return pickupRecordMapper.selectList(new LambdaQueryWrapper<PickupRecord>()
                .eq(PickupRecord::getWindowId, id)
                .orderByDesc(PickupRecord::getId)
                .last("LIMIT 100"));
    }

    private void requireAdmin(HttpServletRequest request) {
        String role = request.getHeader(ROLE);
        if (!ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private CanteenWindow requireWindow(Long id) {
        CanteenWindow w = windowMapper.selectById(id);
        if (w == null) {
            throw new BusinessException(StatusCode.NOT_FOUND);
        }
        return w;
    }

    private static String queueKey(Long windowId) {
        return "window:" + windowId + ":queue";
    }

    private static String currentKey(Long windowId) {
        return "window:" + windowId + ":current";
    }

    private static String historyKey(Long windowId) {
        return "window:" + windowId + ":history";
    }
}
