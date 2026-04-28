package com.canteen.menu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.constant.RoleNames;
import com.canteen.common.constant.UserHeaders;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.StatusCode;
import com.canteen.menu.dto.DishCreateDTO;
import com.canteen.menu.entity.Dish;
import com.canteen.menu.mapper.DishMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DishService {

    private final DishMapper dishMapper;

    public Dish getById(Long id) {
        Dish d = dishMapper.selectById(id);
        if (d == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        return d;
    }

    public Page<Dish> page(long page, long size, Long merchantId) {
        LambdaQueryWrapper<Dish> q = new LambdaQueryWrapper<Dish>()
                .orderByDesc(Dish::getId);
        if (merchantId != null) {
            q.eq(Dish::getMerchantId, merchantId);
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
        dish.setName(dto.getName());
        dish.setDescription(dto.getDescription());
        dish.setPrice(dto.getPrice());
        dish.setImage(dto.getImage());
        dish.setCategory(dto.getCategory());
        dishMapper.updateById(dish);
    }

    @Transactional
    public void delete(HttpServletRequest request, Long id) {
        getOwnedDish(request, id);
        dishMapper.deleteById(id);
    }

    @Transactional
    public void updateStatus(HttpServletRequest request, Long id, Integer status) {
        Dish dish = getOwnedDish(request, id);
        dish.setStatus(status);
        dishMapper.updateById(dish);
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
