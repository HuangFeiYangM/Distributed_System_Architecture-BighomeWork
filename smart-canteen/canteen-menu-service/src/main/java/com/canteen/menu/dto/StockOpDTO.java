package com.canteen.menu.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockOpDTO {
    @NotNull
    private Long menuDishId;

    @NotNull
    @Min(1)
    private Integer quantity;
}
