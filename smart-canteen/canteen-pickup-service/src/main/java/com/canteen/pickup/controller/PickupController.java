package com.canteen.pickup.controller;

import com.canteen.common.result.Result;
import com.canteen.pickup.dto.EnqueueBody;
import com.canteen.pickup.dto.VerifyDTO;
import com.canteen.pickup.dto.WindowCreateDTO;
import com.canteen.pickup.entity.CanteenWindow;
import com.canteen.pickup.service.PickupQueueService;
import com.canteen.pickup.vo.DisplayVO;
import com.canteen.pickup.vo.EnqueueResultVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/pickup")
@RequiredArgsConstructor
public class PickupController {

    private final PickupQueueService pickupQueueService;

    @PostMapping("/enqueue")
    public Result<EnqueueResultVO> enqueue(@Valid @RequestBody EnqueueBody body) {
        return Result.success(pickupQueueService.enqueue(body));
    }

    @PostMapping("/{windowId}/call")
    public Result<String> call(@PathVariable("windowId") Long windowId) {
        return Result.success(pickupQueueService.call(windowId));
    }

    @PostMapping("/verify")
    public Result<Void> verify(@Valid @RequestBody VerifyDTO dto) {
        pickupQueueService.verify(dto);
        return Result.success();
    }

    @GetMapping("/{windowId}/queue")
    public Result<List<String>> queue(@PathVariable("windowId") Long windowId) {
        return Result.success(pickupQueueService.queue(windowId));
    }

    @GetMapping("/{windowId}/display")
    public Result<DisplayVO> display(@PathVariable("windowId") Long windowId) {
        return Result.success(pickupQueueService.display(windowId));
    }

    @GetMapping("/windows")
    public Result<List<CanteenWindow>> windows() {
        return Result.success(pickupQueueService.windows());
    }

    @PostMapping("/window")
    public Result<CanteenWindow> createWindow(HttpServletRequest request, @Valid @RequestBody WindowCreateDTO dto) {
        return Result.success(pickupQueueService.createWindow(request, dto));
    }
}
