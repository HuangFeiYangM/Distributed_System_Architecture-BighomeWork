package com.canteen.menu.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class MenuDetailVO {
    private Long id;
    private String name;
    private Long merchantId;
    private String merchantName;
    private Long windowId;
    private String windowName;
    private LocalDate saleDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer status;
    private java.time.LocalDateTime createTime;
    private java.time.LocalDateTime updateTime;
    private List<MenuDishDetailVO> dishes;
}
