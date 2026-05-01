package com.canteen.menu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.constant.RoleNames;
import com.canteen.common.constant.UserHeaders;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.StatusCode;
import com.canteen.menu.dto.MenuPublishDTO;
import com.canteen.menu.dto.StockOpDTO;
import com.canteen.menu.dto.StockUpdateDTO;
import com.canteen.menu.dto.AdminMenuUpdateDTO;
import com.canteen.menu.dto.AdminMenuDishUpdateDTO;
import com.canteen.menu.entity.Dish;
import com.canteen.menu.entity.Menu;
import com.canteen.menu.entity.MenuDish;
import com.canteen.menu.mapper.DishMapper;
import com.canteen.menu.mapper.MenuDishMapper;
import com.canteen.menu.mapper.MenuMapper;
import com.canteen.menu.vo.MenuDetailVO;
import com.canteen.menu.vo.MenuDishDetailVO;
import com.canteen.menu.vo.StockItemVO;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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

    @Transactional
    public void adminUpdateMenu(HttpServletRequest request, Long menuId, AdminMenuUpdateDTO dto) {
        requireRole(request, RoleNames.ADMIN);
        Menu m = menuMapper.selectById(menuId);
        if (m == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        if (dto.getName() != null && !dto.getName().isBlank()) {
            m.setName(dto.getName().trim());
        }
        if (dto.getSaleDate() != null && !dto.getSaleDate().isBlank()) {
            m.setSaleDate(LocalDate.parse(dto.getSaleDate().trim()));
        }
        if (dto.getStartTime() != null && !dto.getStartTime().isBlank()) {
            m.setStartTime(LocalTime.parse(dto.getStartTime().trim()));
        }
        if (dto.getEndTime() != null && !dto.getEndTime().isBlank()) {
            m.setEndTime(LocalTime.parse(dto.getEndTime().trim()));
        }
        menuMapper.updateById(m);
    }

    @Transactional
    public void adminUpdateMenuStatus(HttpServletRequest request, Long menuId, Integer value) {
        requireRole(request, RoleNames.ADMIN);
        if (value == null || (value != 0 && value != 1)) {
            throw new BusinessException(StatusCode.PARAM_ERROR);
        }
        Menu m = menuMapper.selectById(menuId);
        if (m == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        m.setStatus(value);
        menuMapper.updateById(m);
    }

    @Transactional
    public void adminDeleteMenu(HttpServletRequest request, Long menuId) {
        requireRole(request, RoleNames.ADMIN);
        int n = menuMapper.deleteById(menuId);
        if (n <= 0) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
    }

    @Transactional
    public void adminUpdateMenuDish(HttpServletRequest request, Long menuDishId, AdminMenuDishUpdateDTO dto) {
        requireRole(request, RoleNames.ADMIN);
        MenuDish md = menuDishMapper.selectById(menuDishId);
        if (md == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        // validate dish exists (prevent dangling id in case UI sends wrong data)
        Dish dish = dishMapper.selectById(dto.getDishId());
        if (dish == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        int updated = menuDishMapper.adminUpdateMenuDish(menuDishId, dto.getSalePrice(), dto.getStatus());
        if (updated <= 0) {
            throw new BusinessException(StatusCode.STOCK_CONFLICT);
        }
    }

    public Page<MenuDetailVO> list(long page, long size, String name, Long merchantId, String saleDate, Integer status,
                                   String startDate, String endDate) {
        LambdaQueryWrapper<Menu> q = new LambdaQueryWrapper<>();
        if (name != null && !name.isBlank()) {
            q.like(Menu::getName, name.trim());
        }
        if (status != null) {
            q.eq(Menu::getStatus, status);
        }
        if (saleDate != null && !saleDate.isBlank()) {
            q.eq(Menu::getSaleDate, LocalDate.parse(saleDate.trim()));
        }
        if (startDate != null && !startDate.isBlank()) {
            q.ge(Menu::getSaleDate, LocalDate.parse(startDate.trim()));
        }
        if (endDate != null && !endDate.isBlank()) {
            q.le(Menu::getSaleDate, LocalDate.parse(endDate.trim()));
        }
        q.orderByDesc(Menu::getId);
        Page<Menu> p = menuMapper.selectPage(new Page<>(page, size), q);
        Page<MenuDetailVO> out = new Page<>(p.getCurrent(), p.getSize(), p.getTotal());
        out.setRecords(p.getRecords().stream()
                .map(Menu::getId)
                .map(this::buildDetail)
                .filter(vo -> merchantId == null || merchantId.equals(vo.getMerchantId()))
                .toList());
        return out;
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
                .merchantId(resolveMerchantId(rows))
                .merchantName(buildMerchantName(rows))
                .windowId(null)
                .windowName(null)
                .saleDate(m.getSaleDate())
                .startTime(m.getStartTime())
                .endTime(m.getEndTime())
                .status(m.getStatus())
                .createTime(m.getCreateTime())
                .updateTime(m.getUpdateTime())
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

    public Page<StockItemVO> merchantStock(HttpServletRequest request,
                                           long page,
                                           long size,
                                           String keyword,
                                           Integer status,
                                           Long menuId,
                                           Long dishId,
                                           String saleDate) {
        requireRole(request, RoleNames.MERCHANT);
        Long merchantId = requireUserId(request);
        return menuDishMapper.selectStockPage(new Page<>(page, size), merchantId, clean(keyword), status, menuId, dishId, clean(saleDate), false);
    }

    public Page<StockItemVO> adminStock(HttpServletRequest request,
                                        long page,
                                        long size,
                                        Long merchantId,
                                        String keyword,
                                        Integer status,
                                        Long menuId,
                                        Long dishId,
                                        String saleDate,
                                        Boolean lowStockOnly) {
        requireRole(request, RoleNames.ADMIN);
        return menuDishMapper.selectStockPage(
                new Page<>(page, size),
                merchantId,
                clean(keyword),
                status,
                menuId,
                dishId,
                clean(saleDate),
                Boolean.TRUE.equals(lowStockOnly));
    }

    @Transactional
    public MenuDishDetailVO updateStock(HttpServletRequest request, Long menuDishId, StockUpdateDTO dto) {
        MenuDish md = getAccessibleMenuDish(request, menuDishId);
        Integer sold = md.getSold() == null ? 0 : md.getSold();
        Integer stock = md.getStock() == null ? 0 : md.getStock();
        String op = dto.getOp().trim().toUpperCase(Locale.ROOT);
        Integer value = dto.getValue();
        if ("SET".equals(op)) {
            if (value < sold) {
                throw new BusinessException(StatusCode.STOCK_CONFLICT);
            }
            int updated = menuDishMapper.setStock(menuDishId, value);
            if (updated <= 0) {
                throw new BusinessException(StatusCode.STOCK_CONFLICT);
            }
        } else if ("INCR".equals(op)) {
            if (value <= 0) {
                throw new BusinessException(StatusCode.PARAM_ERROR);
            }
            int updated = menuDishMapper.increaseStock(menuDishId, value);
            if (updated <= 0) {
                throw new BusinessException(StatusCode.STOCK_CONFLICT);
            }
        } else if ("DECR".equals(op)) {
            if (value <= 0) {
                throw new BusinessException(StatusCode.PARAM_ERROR);
            }
            if (stock - value < sold) {
                throw new BusinessException(StatusCode.STOCK_CONFLICT);
            }
            int updated = menuDishMapper.decreaseStock(menuDishId, value);
            if (updated <= 0) {
                throw new BusinessException(StatusCode.STOCK_NOT_ENOUGH);
            }
        } else {
            throw new BusinessException(StatusCode.PARAM_ERROR);
        }
        return menuDishDetail(menuDishId);
    }

    public boolean deduct(HttpServletRequest request, StockOpDTO dto) {
        requireInternalOrPrivileged(request);
        int n = menuDishMapper.deductStock(dto.getMenuDishId(), dto.getQuantity());
        return n > 0;
    }

    public boolean restore(HttpServletRequest request, StockOpDTO dto) {
        requireInternalOrPrivileged(request);
        int n = menuDishMapper.restoreStock(dto.getMenuDishId(), dto.getQuantity());
        return n > 0;
    }

    private Long resolveMerchantId(List<MenuDish> rows) {
        for (MenuDish row : rows) {
            Dish dish = dishMapper.selectById(row.getDishId());
            if (dish != null) {
                return dish.getMerchantId();
            }
        }
        return null;
    }

    private String buildMerchantName(List<MenuDish> rows) {
        Long merchantId = resolveMerchantId(rows);
        if (merchantId == null) {
            return null;
        }
        return "merchant-" + merchantId;
    }

    private MenuDish getAccessibleMenuDish(HttpServletRequest request, Long menuDishId) {
        String role = request.getHeader(UserHeaders.ROLE);
        if (!RoleNames.MERCHANT.equals(role) && !RoleNames.ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        MenuDish md = menuDishMapper.selectById(menuDishId);
        if (md == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        if (RoleNames.ADMIN.equals(role)) {
            return md;
        }
        Dish dish = dishMapper.selectById(md.getDishId());
        if (dish == null) {
            throw new BusinessException(StatusCode.MENU_NOT_FOUND);
        }
        Long uid = requireUserId(request);
        if (!uid.equals(dish.getMerchantId())) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        return md;
    }

    private Long requireUserId(HttpServletRequest request) {
        String uid = request.getHeader(UserHeaders.USER_ID);
        if (uid == null || uid.isBlank()) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        return Long.parseLong(uid);
    }

    private void requireRole(HttpServletRequest request, String expected) {
        String role = request.getHeader(UserHeaders.ROLE);
        if (!expected.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private void requireInternalOrPrivileged(HttpServletRequest request) {
        String internalCall = request.getHeader("X-Internal-Call");
        if ("true".equalsIgnoreCase(internalCall)) {
            return;
        }
        String role = request.getHeader(UserHeaders.ROLE);
        if (role == null || role.isBlank()) {
            return;
        }
        if (!RoleNames.ADMIN.equals(role) && !RoleNames.MERCHANT.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private String clean(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return text.trim();
    }
}
