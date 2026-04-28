package com.canteen.menu.vo;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class MenuDishDetailVO {
    private Long id;
    private Long menuId;
    private Long dishId;
    private String dishName;
    private BigDecimal salePrice;
    private Integer stock;
    private Integer sold;
    private Integer status;
}
