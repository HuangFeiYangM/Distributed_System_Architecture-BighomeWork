package com.canteen.pickup.config;

import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.Result;
import com.canteen.common.result.StatusCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.OK)
    public Result<Void> handleBusiness(BusinessException e) {
        log.warn("BusinessException: code={}, msg={}", e.getStatusCode().getCode(), e.getMessage());
        return Result.error(e.getStatusCode().getCode(), e.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    @ResponseStatus(HttpStatus.OK)
    public Result<Void> handleValidation(Exception e) {
        String msg = StatusCode.PARAM_ERROR.getMsg();
        if (e instanceof MethodArgumentNotValidException m && m.getBindingResult().getFieldError() != null) {
            msg = m.getBindingResult().getFieldError().getDefaultMessage();
        }
        log.warn("Validation failed: {}", msg);
        return Result.error(StatusCode.PARAM_ERROR.getCode(), msg);
    }

    @ExceptionHandler({DuplicateKeyException.class, DataIntegrityViolationException.class})
    @ResponseStatus(HttpStatus.OK)
    public Result<Void> handleDbConflict(Exception e) {
        log.warn("DB conflict", e);
        return Result.error(StatusCode.DUPLICATE_KEY.getCode(), StatusCode.DUPLICATE_KEY.getMsg());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.OK)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        log.warn("Method not supported: {}", e.getMessage());
        return Result.error(StatusCode.PARAM_ERROR.getCode(), "请求方法不支持");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.OK)
    public Result<Void> handleOther(Exception e) {
        log.error("Unhandled exception", e);
        return Result.error(StatusCode.ERROR);
    }
}
