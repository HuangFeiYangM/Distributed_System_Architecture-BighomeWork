package com.canteen.menu.vo;

import lombok.Data;

import java.time.LocalDate;

@Data
public class StockItemVO {
    private Long menuDishId;
    private Long menuId;
    private String menuName;
    private Long dishId;
    private String dishName;
    private Long merchantId;
    private String merchantName;
    private Integer stock;
    private Integer sold;
    private Integer status;
    private LocalDate saleDate;
    private Integer stockThreshold;
}
