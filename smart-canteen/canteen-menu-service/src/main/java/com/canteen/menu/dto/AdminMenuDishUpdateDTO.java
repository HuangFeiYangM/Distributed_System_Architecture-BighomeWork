package com.canteen.menu.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AdminMenuDishUpdateDTO {
    private BigDecimal salePrice;

    private Integer status;

    @NotNull
    @Min(1)
    private Long dishId;
}
