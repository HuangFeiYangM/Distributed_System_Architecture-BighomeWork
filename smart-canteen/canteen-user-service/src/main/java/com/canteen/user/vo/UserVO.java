package com.canteen.user.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserVO {
    private Long id;
    private String studentNo;
    private String phone;
    private String nickname;
    private String avatar;
    private Integer role;
    private Integer status;
}
