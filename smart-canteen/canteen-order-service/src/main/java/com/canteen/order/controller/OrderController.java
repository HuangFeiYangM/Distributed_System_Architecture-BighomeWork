package com.canteen.order.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.result.Result;
import com.canteen.order.dto.CreateOrderDTO;
import com.canteen.order.entity.CanteenOrder;
import com.canteen.order.service.OrdersAppService;
import com.canteen.order.vo.OrderBriefVO;
import com.canteen.order.vo.OrderVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/order")
@RequiredArgsConstructor
public class OrderController {

    private final OrdersAppService ordersAppService;

    @PostMapping
    public Result<OrderVO> create(HttpServletRequest request, @Valid @RequestBody CreateOrderDTO dto) {
        CanteenOrder created = ordersAppService.create(request, dto);
        return Result.success(ordersAppService.detail(request, created.getId()));
    }

    @GetMapping("/{id}")
    public Result<OrderVO> detail(HttpServletRequest request, @PathVariable Long id) {
        return Result.success(ordersAppService.detail(request, id));
    }

    @GetMapping("/my")
    public Result<Page<OrderVO>> my(HttpServletRequest request,
                                   @RequestParam(defaultValue = "1") long page,
                                   @RequestParam(defaultValue = "10") long size) {
        return Result.success(ordersAppService.myOrders(request, page, size));
    }

    @PutMapping("/{id}/accept")
    public Result<Void> accept(HttpServletRequest request, @PathVariable Long id) {
        ordersAppService.accept(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/cook")
    public Result<Void> cook(HttpServletRequest request, @PathVariable Long id) {
        ordersAppService.cook(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/ready")
    public Result<Void> ready(HttpServletRequest request, @PathVariable Long id) {
        ordersAppService.ready(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/cancel")
    public Result<Void> cancel(HttpServletRequest request, @PathVariable Long id) {
        ordersAppService.userCancel(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/pickup")
    public Result<Void> pickup(@PathVariable Long id) {
        ordersAppService.pickupCallback(id);
        return Result.success();
    }

    @GetMapping("/pickup-code/{code}")
    public Result<OrderBriefVO> byPickupCode(@PathVariable String code) {
        return Result.success(ordersAppService.requireByPickupCode(code));
    }
}
