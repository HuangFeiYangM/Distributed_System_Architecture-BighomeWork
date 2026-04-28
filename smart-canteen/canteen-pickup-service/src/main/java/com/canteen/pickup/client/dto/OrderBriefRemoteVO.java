package com.canteen.pickup.client.dto;

import lombok.Data;

@Data
public class OrderBriefRemoteVO {
    private Long id;
    private Long userId;
    private Long windowId;
    private Integer status;
    private String pickupCode;
    private String pickupNo;
}
