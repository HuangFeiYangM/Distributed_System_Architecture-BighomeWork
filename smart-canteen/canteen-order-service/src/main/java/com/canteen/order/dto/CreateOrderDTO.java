package com.canteen.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateOrderDTO {
    @NotNull
    private Long windowId;

    private String remark;

    @NotEmpty
    @Valid
    private List<OrderLineDTO> items;

    @Data
    public static class OrderLineDTO {
        @NotNull
        private Long menuDishId;

        @NotNull
        private Integer quantity;
    }
}
