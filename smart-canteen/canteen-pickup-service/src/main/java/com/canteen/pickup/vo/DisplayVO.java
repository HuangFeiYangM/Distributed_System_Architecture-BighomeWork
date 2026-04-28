package com.canteen.pickup.vo;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DisplayVO {
    private Long windowId;
    private String currentPickupNo;
    private Long currentOrderId;
    private Integer waitingCount;
    private List<String> waitingOrderIds;
    private List<String> recentCalls;
}
