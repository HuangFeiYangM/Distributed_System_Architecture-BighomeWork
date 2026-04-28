package com.canteen.order.client;

import com.canteen.common.result.Result;
import com.canteen.order.client.dto.EnqueueRequest;
import com.canteen.order.client.dto.EnqueueResultVO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "canteen-pickup-service", contextId = "pickupClient")
public interface PickupClient {

    @PostMapping("/pickup/enqueue")
    Result<EnqueueResultVO> enqueue(@RequestBody EnqueueRequest request);
}
