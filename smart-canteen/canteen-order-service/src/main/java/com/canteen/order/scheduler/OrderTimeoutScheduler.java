package com.canteen.order.scheduler;

import com.canteen.order.service.OrdersAppService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderTimeoutScheduler {

    private final OrdersAppService ordersAppService;

    @Scheduled(fixedDelay = 30000)
    public void cancelStaleOrders() {
        try {
            ordersAppService.timeoutCancelBatch();
        } catch (Exception e) {
            log.warn("timeoutCancelBatch failed", e);
        }
    }
}
