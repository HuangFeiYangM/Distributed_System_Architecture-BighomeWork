package com.canteen.menu.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockUpdateDTO {
    @NotBlank
    private String op;

    @NotNull
    @Min(0)
    private Integer value;

    private String reason;
}
