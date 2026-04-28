package com.canteen.order.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("orders")
public class CanteenOrder extends BaseEntity {
    private String orderNo;
    private Long userId;
    private Long windowId;
    private BigDecimal totalAmount;
    private Integer status;
    private String pickupNo;
    private String pickupCode;
    private String remark;
    private Integer cancelType;
    private LocalDateTime cancelTime;
    private LocalDateTime payDeadline;
    private LocalDateTime acceptDeadline;
}
