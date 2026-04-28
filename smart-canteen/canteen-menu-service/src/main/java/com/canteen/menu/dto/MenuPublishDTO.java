package com.canteen.menu.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
public class MenuPublishDTO {
    @NotBlank
    private String name;

    @NotNull
    private LocalDate saleDate;

    @NotNull
    private LocalTime startTime;

    @NotNull
    private LocalTime endTime;

    @NotEmpty
    @Valid
    private List<MenuDishItemDTO> items;

    @Data
    public static class MenuDishItemDTO {
        @NotNull
        private Long dishId;

        @NotNull
        private BigDecimal salePrice;

        @NotNull
        private Integer stock;
    }
}
