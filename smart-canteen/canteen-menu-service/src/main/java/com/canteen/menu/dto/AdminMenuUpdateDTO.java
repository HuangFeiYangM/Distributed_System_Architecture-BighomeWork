package com.canteen.menu.dto;

import lombok.Data;

@Data
public class AdminMenuUpdateDTO {
    private String name;
    private String saleDate;
    private String startTime;
    private String endTime;
}
