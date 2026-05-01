package com.canteen.order.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.result.Result;
import com.canteen.order.dto.CreateOrderDTO;
import com.canteen.order.dto.OrderBatchStatusDTO;
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
import java.util.Map;

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
    public Result<OrderVO> detail(HttpServletRequest request, @PathVariable("id") Long id) {
        return Result.success(ordersAppService.detail(request, id));
    }

    @GetMapping("/my")
    public Result<Page<OrderVO>> my(HttpServletRequest request,
                                   @RequestParam(value = "page", defaultValue = "1") long page,
                                   @RequestParam(value = "size", defaultValue = "10") long size) {
        return Result.success(ordersAppService.myOrders(request, page, size));
    }

    @GetMapping("/merchant")
    public Result<Page<OrderVO>> merchant(HttpServletRequest request,
                                          @RequestParam(value = "page", defaultValue = "1") long page,
                                          @RequestParam(value = "size", defaultValue = "10") long size,
                                          @RequestParam(value = "status", required = false) Integer status,
                                          @RequestParam(value = "windowId", required = false) Long windowId,
                                          @RequestParam(value = "keyword", required = false) String keyword,
                                          @RequestParam(value = "dateFrom", required = false) String dateFrom,
                                          @RequestParam(value = "dateTo", required = false) String dateTo) {
        return Result.success(ordersAppService.merchantOrders(request, page, size, status, windowId, keyword, dateFrom, dateTo));
    }

    @GetMapping("/list")
    public Result<Page<OrderVO>> list(HttpServletRequest request,
                                      @RequestParam(value = "page", defaultValue = "1") long page,
                                      @RequestParam(value = "size", defaultValue = "10") long size,
                                      @RequestParam(value = "status", required = false) Integer status,
                                      @RequestParam(value = "merchantId", required = false) Long merchantId,
                                      @RequestParam(value = "windowId", required = false) Long windowId,
                                      @RequestParam(value = "userId", required = false) Long userId,
                                      @RequestParam(value = "keyword", required = false) String keyword,
                                      @RequestParam(value = "dateFrom", required = false) String dateFrom,
                                      @RequestParam(value = "dateTo", required = false) String dateTo) {
        return Result.success(ordersAppService.adminOrders(request, page, size, status, merchantId, windowId, userId, keyword, dateFrom, dateTo));
    }

    @PutMapping("/{id}/accept")
    public Result<Void> accept(HttpServletRequest request, @PathVariable("id") Long id) {
        ordersAppService.accept(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/cook")
    public Result<Void> cook(HttpServletRequest request, @PathVariable("id") Long id) {
        ordersAppService.cook(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/ready")
    public Result<Void> ready(HttpServletRequest request, @PathVariable("id") Long id) {
        ordersAppService.ready(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/cancel")
    public Result<Void> cancel(HttpServletRequest request, @PathVariable("id") Long id) {
        ordersAppService.userCancel(request, id);
        return Result.success();
    }

    @PutMapping("/{id}/pickup")
    public Result<Void> pickup(@PathVariable("id") Long id) {
        ordersAppService.pickupCallback(id);
        return Result.success();
    }

    @GetMapping("/pickup-code/{code}")
    public Result<OrderBriefVO> byPickupCode(@PathVariable("code") String code) {
        return Result.success(ordersAppService.requireByPickupCode(code));
    }

    @PostMapping("/{id}/remark")
    public Result<Void> remark(HttpServletRequest request, @PathVariable("id") Long id, @RequestParam("remark") String remark) {
        ordersAppService.remark(request, id, remark);
        return Result.success();
    }

    @PostMapping("/batch/status")
    public Result<Void> batchStatus(HttpServletRequest request, @RequestBody OrderBatchStatusDTO dto) {
        ordersAppService.batchStatus(request, dto);
        return Result.success();
    }

    @GetMapping("/stat/merchant/dashboard")
    public Result<Map<String, Object>> merchantDashboard(HttpServletRequest request) {
        return Result.success(ordersAppService.merchantDashboard(request));
    }

    @GetMapping("/stat/admin/dashboard")
    public Result<Map<String, Object>> adminDashboard(HttpServletRequest request) {
        return Result.success(ordersAppService.adminDashboard(request));
    }
}
