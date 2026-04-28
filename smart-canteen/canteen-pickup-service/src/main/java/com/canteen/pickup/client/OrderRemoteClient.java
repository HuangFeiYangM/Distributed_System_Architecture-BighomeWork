package com.canteen.pickup.client;

import com.canteen.common.result.Result;
import com.canteen.pickup.client.dto.OrderBriefRemoteVO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;

@FeignClient(name = "canteen-order-service", contextId = "orderRemoteClient")
public interface OrderRemoteClient {

    @PutMapping("/order/{id}/pickup")
    Result<Void> pickupDone(@PathVariable("id") Long id);

    @GetMapping("/order/pickup-code/{code}")
    Result<OrderBriefRemoteVO> findByPickupCode(@PathVariable("code") String code);
}
