package com.canteen.order.client.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class MenuDishRemoteVO {
    private Long id;
    private Long menuId;
    private Long dishId;
    private String dishName;
    private BigDecimal salePrice;
    private Integer stock;
    private Integer sold;
    private Integer status;
}
