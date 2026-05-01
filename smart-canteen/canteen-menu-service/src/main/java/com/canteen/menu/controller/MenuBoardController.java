package com.canteen.menu.controller;

import com.canteen.common.result.Result;
import com.canteen.menu.dto.MenuPublishDTO;
import com.canteen.menu.dto.StockOpDTO;
import com.canteen.menu.dto.StockUpdateDTO;
import com.canteen.menu.dto.AdminMenuUpdateDTO;
import com.canteen.menu.dto.AdminMenuDishUpdateDTO;
import com.canteen.menu.entity.Menu;
import com.canteen.menu.service.DailyMenuService;
import com.canteen.menu.vo.MenuDetailVO;
import com.canteen.menu.vo.MenuDishDetailVO;
import com.canteen.menu.vo.StockItemVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

@RestController
@RequestMapping("/menu")
@RequiredArgsConstructor
public class MenuBoardController {

    private final DailyMenuService dailyMenuService;

    @PostMapping
    public Result<Menu> publish(@Valid @RequestBody MenuPublishDTO dto) {
        return Result.success(dailyMenuService.publish(dto));
    }

    @GetMapping("/today")
    public Result<List<MenuDetailVO>> today() {
        return Result.success(dailyMenuService.todayMenus());
    }

    @GetMapping("/{id}")
    public Result<MenuDetailVO> detail(@PathVariable("id") Long id) {
        return Result.success(dailyMenuService.detail(id));
    }

    @PutMapping("/{id}")
    public Result<Void> adminUpdateMenu(HttpServletRequest request, @PathVariable("id") Long id, @RequestBody AdminMenuUpdateDTO dto) {
        dailyMenuService.adminUpdateMenu(request, id, dto);
        return Result.success();
    }

    @PutMapping("/{id}/status")
    public Result<Void> adminUpdateMenuStatus(HttpServletRequest request, @PathVariable("id") Long id, @RequestParam("value") Integer value) {
        dailyMenuService.adminUpdateMenuStatus(request, id, value);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> adminDeleteMenu(HttpServletRequest request, @PathVariable("id") Long id) {
        dailyMenuService.adminDeleteMenu(request, id);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<Page<MenuDetailVO>> list(@RequestParam(value = "page", defaultValue = "1") long page,
                                           @RequestParam(value = "size", defaultValue = "10") long size,
                                           @RequestParam(value = "name", required = false) String name,
                                           @RequestParam(value = "merchantId", required = false) Long merchantId,
                                           @RequestParam(value = "saleDate", required = false) String saleDate,
                                           @RequestParam(value = "status", required = false) Integer status,
                                           @RequestParam(value = "startDate", required = false) String startDate,
                                           @RequestParam(value = "endDate", required = false) String endDate) {
        return Result.success(dailyMenuService.list(page, size, name, merchantId, saleDate, status, startDate, endDate));
    }

    @GetMapping("/dish/{menuDishId}")
    public Result<MenuDishDetailVO> menuDish(@PathVariable("menuDishId") Long menuDishId) {
        return Result.success(dailyMenuService.menuDishDetail(menuDishId));
    }

    @PutMapping("/dish/{menuDishId}")
    public Result<Void> adminUpdateMenuDish(HttpServletRequest request,
                                            @PathVariable("menuDishId") Long menuDishId,
                                            @Valid @RequestBody AdminMenuDishUpdateDTO dto) {
        dailyMenuService.adminUpdateMenuDish(request, menuDishId, dto);
        return Result.success();
    }

    @GetMapping("/stock/merchant")
    public Result<Page<StockItemVO>> merchantStock(HttpServletRequest request,
                                                   @RequestParam(value = "page", defaultValue = "1") long page,
                                                   @RequestParam(value = "size", defaultValue = "10") long size,
                                                   @RequestParam(value = "keyword", required = false) String keyword,
                                                   @RequestParam(value = "status", required = false) Integer status,
                                                   @RequestParam(value = "menuId", required = false) Long menuId,
                                                   @RequestParam(value = "dishId", required = false) Long dishId,
                                                   @RequestParam(value = "saleDate", required = false) String saleDate) {
        return Result.success(dailyMenuService.merchantStock(request, page, size, keyword, status, menuId, dishId, saleDate));
    }

    @GetMapping("/stock/list")
    public Result<Page<StockItemVO>> adminStock(HttpServletRequest request,
                                                @RequestParam(value = "page", defaultValue = "1") long page,
                                                @RequestParam(value = "size", defaultValue = "10") long size,
                                                @RequestParam(value = "merchantId", required = false) Long merchantId,
                                                @RequestParam(value = "keyword", required = false) String keyword,
                                                @RequestParam(value = "status", required = false) Integer status,
                                                @RequestParam(value = "menuId", required = false) Long menuId,
                                                @RequestParam(value = "dishId", required = false) Long dishId,
                                                @RequestParam(value = "saleDate", required = false) String saleDate,
                                                @RequestParam(value = "lowStockOnly", required = false) Boolean lowStockOnly) {
        return Result.success(dailyMenuService.adminStock(request, page, size, merchantId, keyword, status, menuId, dishId, saleDate, lowStockOnly));
    }

    @PutMapping("/stock/{menuDishId}")
    public Result<MenuDishDetailVO> updateStock(HttpServletRequest request,
                                                @PathVariable("menuDishId") Long menuDishId,
                                                @Valid @RequestBody StockUpdateDTO dto) {
        return Result.success(dailyMenuService.updateStock(request, menuDishId, dto));
    }

    @PostMapping("/deduct")
    public Result<Boolean> deduct(HttpServletRequest request, @Valid @RequestBody StockOpDTO dto) {
        return Result.success(dailyMenuService.deduct(request, dto));
    }

    @PostMapping("/restore")
    public Result<Boolean> restore(HttpServletRequest request, @Valid @RequestBody StockOpDTO dto) {
        return Result.success(dailyMenuService.restore(request, dto));
    }
}
