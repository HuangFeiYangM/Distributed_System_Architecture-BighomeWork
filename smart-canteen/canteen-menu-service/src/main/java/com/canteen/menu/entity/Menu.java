package com.canteen.menu.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("menu")
public class Menu extends BaseEntity {
    private String name;
    private LocalDate saleDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer status;
}
