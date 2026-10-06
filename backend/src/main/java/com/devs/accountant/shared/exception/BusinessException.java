package com.devs.accountant.shared.exception;

import java.util.Map;
import lombok.Getter;

/**
 * Base exception for business rule violations. The frontend translates the message from {@link #getCode()} and
 * {@link #getParams()}; {@link #getMessage()} is only meant for logs.
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode code;
    private final Map<String, Object> params;
    private final String transactionUuid;

    public BusinessException(ErrorCode code, String message) {
        this(code, message, Map.of(), null);
    }

    public BusinessException(ErrorCode code, String message, Map<String, Object> params) {
        this(code, message, params, null);
    }

    public BusinessException(ErrorCode code, String message, Map<String, Object> params, String transactionUuid) {
        super(message);
        this.code = code;
        this.params = params == null ? Map.of() : Map.copyOf(params);
        this.transactionUuid = transactionUuid;
    }
}
