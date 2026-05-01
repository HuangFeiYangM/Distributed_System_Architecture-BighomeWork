package com.canteen.menu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.constant.RoleNames;
import com.canteen.common.constant.UserHeaders;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.StatusCode;
import com.canteen.menu.dto.DishCreateDTO;
import com.canteen.menu.entity.Dish;
import com.canteen.menu.entity.Menu;
import com.canteen.menu.entity.MenuDish;
import com.canteen.menu.mapper.DishMapper;
import com.canteen.menu.mapper.MenuDishMapper;
import com.canteen.menu.mapper.MenuMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DishService {

    private final DishMapper dishMapper;
    private final MenuDishMapper menuDishMapper;
    private final MenuMapper menuMapper;

    public Dish getById(Long id) {
        Dish d = dishMapper.selectById(id);
        if (d == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        return d;
    }

    public Page<Dish> page(long page, long size, Long merchantId, String name, String category, Integer status,
                           BigDecimal minPrice, BigDecimal maxPrice) {
        LambdaQueryWrapper<Dish> q = new LambdaQueryWrapper<Dish>()
                .orderByDesc(Dish::getId);
        if (merchantId != null) {
            q.eq(Dish::getMerchantId, merchantId);
        }
        if (name != null && !name.isBlank()) {
            q.like(Dish::getName, name.trim());
        }
        if (category != null && !category.isBlank()) {
            q.like(Dish::getCategory, category.trim());
        }
        if (status != null) {
            q.eq(Dish::getStatus, status);
        }
        if (minPrice != null) {
            q.ge(Dish::getPrice, minPrice);
        }
        if (maxPrice != null) {
            q.le(Dish::getPrice, maxPrice);
        }
        return dishMapper.selectPage(new Page<>(page, size), q);
    }

    @Transactional
    public Dish create(HttpServletRequest request, DishCreateDTO dto) {
        requireMerchantOrAdmin(request);
        Long merchantId = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        Dish dish = new Dish();
        dish.setMerchantId(merchantId);
        dish.setName(dto.getName());
        dish.setDescription(dto.getDescription());
        dish.setPrice(dto.getPrice());
        dish.setImage(dto.getImage());
        dish.setCategory(dto.getCategory());
        dish.setStatus(1);
        dish.setStockThreshold(10);
        dishMapper.insert(dish);
        return dish;
    }

    @Transactional
    public void update(HttpServletRequest request, Long id, DishCreateDTO dto) {
        Dish dish = getOwnedDish(request, id);
        ensureDishCanModify(dish.getId());
        dish.setName(dto.getName());
        dish.setDescription(dto.getDescription());
        dish.setPrice(dto.getPrice());
        dish.setImage(dto.getImage());
        dish.setCategory(dto.getCategory());
        dishMapper.updateById(dish);
    }

    @Transactional
    public void delete(HttpServletRequest request, Long id) {
        Dish dish = getOwnedDish(request, id);
        ensureDishCanModify(dish.getId());
        dishMapper.deleteById(id);
    }

    @Transactional
    public void updateStatus(HttpServletRequest request, Long id, Integer status) {
        Dish dish = getOwnedDish(request, id);
        ensureDishCanModify(dish.getId());
        dish.setStatus(status);
        dishMapper.updateById(dish);
    }

    private void ensureDishCanModify(Long dishId) {
        List<MenuDish> refs = menuDishMapper.selectList(new LambdaQueryWrapper<MenuDish>().eq(MenuDish::getDishId, dishId));
        for (MenuDish ref : refs) {
            Menu menu = menuMapper.selectById(ref.getMenuId());
            if (menu != null && Integer.valueOf(1).equals(menu.getStatus())) {
                throw new BusinessException(StatusCode.DISH_MENU_CONFLICT);
            }
        }
    }

    private Dish getOwnedDish(HttpServletRequest request, Long id) {
        requireMerchantOrAdmin(request);
        Dish dish = dishMapper.selectById(id);
        if (dish == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        Long uid = Long.parseLong(request.getHeader(UserHeaders.USER_ID));
        String role = request.getHeader(UserHeaders.ROLE);
        if (RoleNames.ADMIN.equals(role)) {
            return dish;
        }
        if (!uid.equals(dish.getMerchantId())) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        return dish;
    }

    private static void requireMerchantOrAdmin(HttpServletRequest request) {
        String role = request.getHeader(UserHeaders.ROLE);
        if (!RoleNames.MERCHANT.equals(role) && !RoleNames.ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }
}
