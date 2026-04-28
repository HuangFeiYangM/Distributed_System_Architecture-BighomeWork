package com.canteen.menu.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.result.Result;
import com.canteen.menu.dto.DishCreateDTO;
import com.canteen.menu.entity.Dish;
import com.canteen.menu.service.DishService;
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

@RestController
@RequestMapping("/dish")
@RequiredArgsConstructor
public class DishController {

    private final DishService dishService;

    @PostMapping
    public Result<Dish> create(HttpServletRequest request, @Valid @RequestBody DishCreateDTO dto) {
        return Result.success(dishService.create(request, dto));
    }

    @PutMapping("/{id}")
    public Result<Void> update(HttpServletRequest request, @PathVariable Long id, @Valid @RequestBody DishCreateDTO dto) {
        dishService.update(request, id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(HttpServletRequest request, @PathVariable Long id) {
        dishService.delete(request, id);
        return Result.success();
    }

    @GetMapping("/{id}")
    public Result<Dish> get(@PathVariable Long id) {
        return Result.success(dishService.getById(id));
    }

    @GetMapping("/list")
    public Result<Page<Dish>> list(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) Long merchantId) {
        return Result.success(dishService.page(page, size, merchantId));
    }

    @PutMapping("/{id}/status")
    public Result<Void> status(HttpServletRequest request, @PathVariable Long id, @RequestParam Integer value) {
        dishService.updateStatus(request, id, value);
        return Result.success();
    }
}
