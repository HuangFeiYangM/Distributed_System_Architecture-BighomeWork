package com.canteen.pickup.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EnqueueBody {
    @NotNull
    private Long orderId;

    @NotNull
    private Long windowId;
}
