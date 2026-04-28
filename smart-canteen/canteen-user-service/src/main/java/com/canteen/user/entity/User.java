package com.canteen.user.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user")
public class User extends BaseEntity {
    private String studentNo;
    private String phone;
    private String password;
    private String nickname;
    private String avatar;
    private Integer role;
    private Integer status;
}
