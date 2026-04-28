package com.canteen.common.result;

import lombok.Data;

@Data
public class Result<T> {
    private Integer code;
    private String msg;
    private T data;
    private Long timestamp;

    public static <T> Result<T> success() {
        return success(null);
    }

    public static <T> Result<T> success(T data) {
        Result<T> r = new Result<>();
        r.setCode(StatusCode.SUCCESS.getCode());
        r.setMsg(StatusCode.SUCCESS.getMsg());
        r.setData(data);
        r.setTimestamp(System.currentTimeMillis());
        return r;
    }

    public static <T> Result<T> error(StatusCode statusCode) {
        Result<T> r = new Result<>();
        r.setCode(statusCode.getCode());
        r.setMsg(statusCode.getMsg());
        r.setData(null);
        r.setTimestamp(System.currentTimeMillis());
        return r;
    }

    public static <T> Result<T> error(int code, String msg) {
        Result<T> r = new Result<>();
        r.setCode(code);
        r.setMsg(msg);
        r.setData(null);
        r.setTimestamp(System.currentTimeMillis());
        return r;
    }

    public boolean isSuccess() {
        return code != null && code == StatusCode.SUCCESS.getCode();
    }
}
