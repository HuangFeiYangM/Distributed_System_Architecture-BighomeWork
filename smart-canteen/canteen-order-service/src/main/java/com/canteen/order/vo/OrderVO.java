package com.canteen.order.vo;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class OrderVO {
    private Long id;
    private String orderNo;
    private Long userId;
    private Long windowId;
    private BigDecimal totalAmount;
    private Integer status;
    private String pickupNo;
    private String pickupCode;
    private String remark;
    private LocalDateTime payDeadline;
    private LocalDateTime acceptDeadline;
    private LocalDateTime createTime;
    private List<OrderItemVO> items;

    @Data
    @Builder
    public static class OrderItemVO {
        private Long dishId;
        private Long menuDishId;
        private String dishName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal subtotal;
    }
}
