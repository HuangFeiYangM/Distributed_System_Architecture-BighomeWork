package com.canteen.order.client;

import com.canteen.common.result.Result;
import com.canteen.order.client.dto.EnqueueRequest;
import com.canteen.order.client.dto.EnqueueResultVO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

@FeignClient(name = "canteen-pickup-service", contextId = "pickupClient")
public interface PickupClient {

    @PostMapping("/pickup/enqueue")
    Result<EnqueueResultVO> enqueue(@RequestBody EnqueueRequest request);

    @GetMapping("/pickup/windows")
    Result<Map<String, Object>> windows(@RequestParam("page") long page,
                                        @RequestParam("size") long size,
                                        @RequestParam("merchantId") Long merchantId);
}
