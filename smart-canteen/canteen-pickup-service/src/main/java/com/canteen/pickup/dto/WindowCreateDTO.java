package com.canteen.pickup.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WindowCreateDTO {
    @NotBlank
    private String name;

    private String location;

    private Long merchantId;

    private String pickupPrefix;
}
