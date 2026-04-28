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
    private LocalDate saleDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer status;
    private List<MenuDishDetailVO> dishes;
}
