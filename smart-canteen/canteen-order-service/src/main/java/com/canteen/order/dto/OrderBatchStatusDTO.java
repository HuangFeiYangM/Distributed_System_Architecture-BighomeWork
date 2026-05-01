package com.canteen.order.dto;

import lombok.Data;

import java.util.List;

@Data
public class OrderBatchStatusDTO {
    private List<Long> orderIds;
    private Integer status;
}
