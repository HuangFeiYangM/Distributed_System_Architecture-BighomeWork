package com.canteen.common.result;

import lombok.Getter;

@Getter
public enum StatusCode {
    SUCCESS(200, "操作成功"),

    PARAM_ERROR(400, "参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "禁止访问"),
    NOT_FOUND(404, "资源不存在"),

    ERROR(500, "系统内部错误"),

    USER_NOT_FOUND(1002, "用户不存在"),
    USER_EXISTS(1003, "用户已存在"),
    PASSWORD_ERROR(1004, "密码错误"),
    TOKEN_EXPIRED(1005, "登录已失效，请重新登录"),

    STOCK_NOT_ENOUGH(2002, "库存不足"),
    MENU_NOT_FOUND(2003, "菜单或菜品不存在"),
    STOCK_CONFLICT(2004, "库存状态冲突"),

    ORDER_NOT_FOUND(3001, "订单不存在"),
    ORDER_STATUS_ERROR(3002, "订单状态不允许此操作"),
    DISH_MENU_CONFLICT(3008, "菜品已被生效菜单引用，不可修改"),

    QUEUE_EMPTY(4002, "当前队列无订单"),
    PICKUP_VERIFY_FAILED(4003, "取餐码校验失败"),

    DUPLICATE_KEY(4090, "数据冲突");

    private final int code;
    private final String msg;

    StatusCode(int code, String msg) {
        this.code = code;
        this.msg = msg;
    }
}
