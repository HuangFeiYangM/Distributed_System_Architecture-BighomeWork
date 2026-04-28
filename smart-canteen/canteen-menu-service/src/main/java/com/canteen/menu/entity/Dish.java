package com.canteen.menu.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dish")
public class Dish extends BaseEntity {
    private Long merchantId;
    private String name;
    private String description;
    private BigDecimal price;
    private String image;
    private String category;
    private Integer status;
    private Integer stockThreshold;
}
