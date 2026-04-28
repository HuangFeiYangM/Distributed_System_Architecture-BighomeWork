package com.canteen.order.client;

import com.canteen.common.result.Result;
import com.canteen.order.client.dto.MenuDishRemoteVO;
import com.canteen.order.client.dto.MenuStockOpDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "canteen-menu-service", contextId = "menuClient")
public interface MenuClient {

    @GetMapping("/menu/dish/{menuDishId}")
    Result<MenuDishRemoteVO> getMenuDish(@PathVariable("menuDishId") Long menuDishId);

    @PostMapping("/menu/deduct")
    Result<Boolean> deduct(@RequestBody MenuStockOpDTO dto);

    @PostMapping("/menu/restore")
    Result<Boolean> restore(@RequestBody MenuStockOpDTO dto);
}
