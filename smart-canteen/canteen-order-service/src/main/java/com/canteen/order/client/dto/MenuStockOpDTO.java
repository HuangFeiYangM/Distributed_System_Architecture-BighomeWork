package com.canteen.order.client.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MenuStockOpDTO {
    private Long menuDishId;
    private Integer quantity;
}
