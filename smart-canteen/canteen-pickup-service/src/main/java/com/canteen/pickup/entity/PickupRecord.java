package com.canteen.pickup.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pickup_record")
public class PickupRecord extends BaseEntity {
    private Long orderId;
    private Long windowId;
    private String pickupNo;
    /** 0排队 1已叫号 2已取餐 3已过号 */
    private Integer queueStatus;
    private LocalDateTime queueTime;
    private LocalDateTime callTime;
    private LocalDateTime pickupTime;
}
