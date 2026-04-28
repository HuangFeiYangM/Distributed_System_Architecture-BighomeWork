package com.canteen.order.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderBriefVO {
    private Long id;
    private Long userId;
    private Long windowId;
    private Integer status;
    private String pickupCode;
    private String pickupNo;
}
