package com.canteen.menu.controller;

import com.canteen.common.result.Result;
import com.canteen.menu.dto.MenuPublishDTO;
import com.canteen.menu.dto.StockOpDTO;
import com.canteen.menu.entity.Menu;
import com.canteen.menu.service.DailyMenuService;
import com.canteen.menu.vo.MenuDetailVO;
import com.canteen.menu.vo.MenuDishDetailVO;
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

    @GetMapping("/dish/{menuDishId}")
    public Result<MenuDishDetailVO> menuDish(@PathVariable("menuDishId") Long menuDishId) {
        return Result.success(dailyMenuService.menuDishDetail(menuDishId));
    }

    @PostMapping("/deduct")
    public Result<Boolean> deduct(@Valid @RequestBody StockOpDTO dto) {
        return Result.success(dailyMenuService.deduct(dto));
    }

    @PostMapping("/restore")
    public Result<Boolean> restore(@Valid @RequestBody StockOpDTO dto) {
        return Result.success(dailyMenuService.restore(dto));
    }
}
