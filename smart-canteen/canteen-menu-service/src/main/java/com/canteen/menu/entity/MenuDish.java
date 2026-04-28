package com.canteen.menu.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("menu_dish")
public class MenuDish extends BaseEntity {
    private Long menuId;
    private Long dishId;
    private BigDecimal salePrice;
    private Integer stock;
    private Integer sold;
    private Integer status;
}
