package com.canteen.common.exception;

import com.canteen.common.result.StatusCode;
import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {
    private final StatusCode statusCode;

    public BusinessException(StatusCode statusCode) {
        super(statusCode.getMsg());
        this.statusCode = statusCode;
    }

    public BusinessException(StatusCode statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public BusinessException(String message) {
        super(message);
        this.statusCode = StatusCode.ERROR;
    }
}
