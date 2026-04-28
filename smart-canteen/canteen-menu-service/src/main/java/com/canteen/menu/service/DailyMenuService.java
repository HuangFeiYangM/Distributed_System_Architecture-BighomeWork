package com.canteen.menu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.StatusCode;
import com.canteen.menu.dto.MenuPublishDTO;
import com.canteen.menu.dto.StockOpDTO;
import com.canteen.menu.entity.Dish;
import com.canteen.menu.entity.Menu;
import com.canteen.menu.entity.MenuDish;
import com.canteen.menu.mapper.DishMapper;
import com.canteen.menu.mapper.MenuDishMapper;
import com.canteen.menu.mapper.MenuMapper;
import com.canteen.menu.vo.MenuDetailVO;
import com.canteen.menu.vo.MenuDishDetailVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DailyMenuService {

    private final MenuMapper menuMapper;
    private final MenuDishMapper menuDishMapper;
    private final DishMapper dishMapper;

    @Transactional
    public Menu publish(MenuPublishDTO dto) {
        Menu menu = new Menu();
        menu.setName(dto.getName());
        menu.setSaleDate(dto.getSaleDate());
        menu.setStartTime(dto.getStartTime());
        menu.setEndTime(dto.getEndTime());
        menu.setStatus(1);
        menuMapper.insert(menu);

        for (MenuPublishDTO.MenuDishItemDTO item : dto.getItems()) {
            MenuDish md = new MenuDish();
            md.setMenuId(menu.getId());
            md.setDishId(item.getDishId());
            md.setSalePrice(item.getSalePrice());
            md.setStock(item.getStock());
            md.setSold(0);
            md.setStatus(1);
            menuDishMapper.insert(md);
        }
        return menu;
    }

    public List<MenuDetailVO> todayMenus() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        List<Menu> menus = menuMapper.selectList(new LambdaQueryWrapper<Menu>()
                .eq(Menu::getSaleDate, today)
                .eq(Menu::getStatus, 1));
        List<MenuDetailVO> out = new ArrayList<>();
        for (Menu m : menus) {
            if (now.isBefore(m.getStartTime()) || now.isAfter(m.getEndTime())) {
                continue;
            }
            out.add(buildDetail(m.getId()));
        }
        return out;
    }

    public MenuDetailVO detail(Long menuId) {
        Menu m = menuMapper.selectById(menuId);
        if (m == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        return buildDetail(menuId);
    }

    private MenuDetailVO buildDetail(Long menuId) {
        Menu m = menuMapper.selectById(menuId);
        List<MenuDish> rows = menuDishMapper.selectList(new LambdaQueryWrapper<MenuDish>()
                .eq(MenuDish::getMenuId, menuId));
        List<MenuDishDetailVO> dishes = new ArrayList<>();
        for (MenuDish md : rows) {
            Dish dish = dishMapper.selectById(md.getDishId());
            dishes.add(MenuDishDetailVO.builder()
                    .id(md.getId())
                    .menuId(md.getMenuId())
                    .dishId(md.getDishId())
                    .dishName(dish != null ? dish.getName() : "?")
                    .salePrice(md.getSalePrice())
                    .stock(md.getStock())
                    .sold(md.getSold())
                    .status(md.getStatus())
                    .build());
        }
        return MenuDetailVO.builder()
                .id(m.getId())
                .name(m.getName())
                .saleDate(m.getSaleDate())
                .startTime(m.getStartTime())
                .endTime(m.getEndTime())
                .status(m.getStatus())
                .dishes(dishes)
                .build();
    }

    public MenuDishDetailVO menuDishDetail(Long menuDishId) {
        MenuDish md = menuDishMapper.selectById(menuDishId);
        if (md == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        Dish dish = dishMapper.selectById(md.getDishId());
        return MenuDishDetailVO.builder()
                .id(md.getId())
                .menuId(md.getMenuId())
                .dishId(md.getDishId())
                .dishName(dish != null ? dish.getName() : "?")
                .salePrice(md.getSalePrice())
                .stock(md.getStock())
                .sold(md.getSold())
                .status(md.getStatus())
                .build();
    }

    public boolean deduct(StockOpDTO dto) {
        int n = menuDishMapper.deductStock(dto.getMenuDishId(), dto.getQuantity());
        return n > 0;
    }

    public boolean restore(StockOpDTO dto) {
        int n = menuDishMapper.restoreStock(dto.getMenuDishId(), dto.getQuantity());
        return n > 0;
    }
}
