package com.canteen.order.controller;

import com.canteen.common.result.Result;
import com.canteen.order.service.OrdersAppService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/stat")
@RequiredArgsConstructor
public class StatController {

    private final OrdersAppService ordersAppService;

    @GetMapping("/merchant/dashboard")
    public Result<Map<String, Object>> merchantDashboard(HttpServletRequest request) {
        return Result.success(ordersAppService.merchantDashboard(request));
    }

    @GetMapping("/admin/dashboard")
    public Result<Map<String, Object>> adminDashboard(HttpServletRequest request) {
        return Result.success(ordersAppService.adminDashboard(request));
    }
}
