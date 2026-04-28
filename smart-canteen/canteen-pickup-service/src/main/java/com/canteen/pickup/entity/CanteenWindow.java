package com.canteen.pickup.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.canteen.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("canteen_window")
public class CanteenWindow extends BaseEntity {
    private String name;
    private String location;
    private Long merchantId;
    private Integer status;
    /** 取餐号前缀 */
    private String pickupPrefix;
}
