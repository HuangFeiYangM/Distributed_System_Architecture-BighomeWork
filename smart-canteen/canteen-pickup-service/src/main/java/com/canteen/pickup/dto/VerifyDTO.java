package com.canteen.pickup.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyDTO {
    @NotBlank
    private String pickupCode;
}
