package com.canteen.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminResetPasswordDTO {

    /** 管理员为指定用户设置的新密码 */
    @NotBlank
    @Size(min = 6, max = 20)
    private String password;
}
