package com.canteen.pickup.controller;

import com.canteen.common.result.Result;
import com.canteen.pickup.dto.EnqueueBody;
import com.canteen.pickup.dto.VerifyDTO;
import com.canteen.pickup.dto.WindowCreateDTO;
import com.canteen.pickup.entity.CanteenWindow;
import com.canteen.pickup.service.PickupQueueService;
import com.canteen.pickup.vo.DisplayVO;
import com.canteen.pickup.vo.EnqueueResultVO;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public Result<Page<CanteenWindow>> windows(
            @RequestParam(value = "page", defaultValue = "1") long page,
            @RequestParam(value = "size", defaultValue = "10") long size,
            @RequestParam(value = "status", required = false) Integer status,
            @RequestParam(value = "merchantId", required = false) Long merchantId,
            @RequestParam(value = "keyword", required = false) String keyword) {
        return Result.success(pickupQueueService.windows(page, size, status, merchantId, keyword));
    }

    @PostMapping("/window")
    public Result<CanteenWindow> createWindow(HttpServletRequest request, @Valid @RequestBody WindowCreateDTO dto) {
        return Result.success(pickupQueueService.createWindow(request, dto));
    }

    @PutMapping("/window/{id}")
    public Result<Void> updateWindow(HttpServletRequest request, @PathVariable("id") Long id, @Valid @RequestBody WindowCreateDTO dto) {
        pickupQueueService.updateWindow(request, id, dto);
        return Result.success();
    }

    @PutMapping("/window/{id}/status")
    public Result<Void> updateWindowStatus(HttpServletRequest request, @PathVariable("id") Long id, @RequestParam("value") Integer value) {
        pickupQueueService.updateWindowStatus(request, id, value);
        return Result.success();
    }

    @DeleteMapping("/window/{id}")
    public Result<Void> deleteWindow(HttpServletRequest request, @PathVariable("id") Long id) {
        pickupQueueService.deleteWindow(request, id);
        return Result.success();
    }

    @GetMapping("/window/{id}/history")
    public Result<List<com.canteen.pickup.entity.PickupRecord>> history(@PathVariable("id") Long id) {
        return Result.success(pickupQueueService.history(id));
    }
}
