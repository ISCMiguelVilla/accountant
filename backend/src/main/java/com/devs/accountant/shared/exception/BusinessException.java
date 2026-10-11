package com.devs.accountant.shared.exception;

import java.util.Map;
import lombok.Getter;

/**
 * Base exception for business rule violations. The frontend translates the message from {@link #getCode()},
 * {@link #getParams()} and, for field validations, {@link #getErrors()} (field → error code); {@link #getMessage()}
 * is only meant for logs.
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode code;
    private final Map<String, Object> params;
    private final String transactionUuid;
    private final Map<String, String> errors;

    public BusinessException(ErrorCode code, String message) {
        this(code, message, Map.of(), null, Map.of());
    }

    public BusinessException(ErrorCode code, String message, Map<String, Object> params) {
        this(code, message, params, null, Map.of());
    }

    public BusinessException(ErrorCode code, String message, Map<String, Object> params, String transactionUuid) {
        this(code, message, params, transactionUuid, Map.of());
    }

    public BusinessException(
            ErrorCode code,
            String message,
            Map<String, Object> params,
            String transactionUuid,
            Map<String, String> errors) {
        super(message);
        this.code = code;
        this.params = params == null ? Map.of() : Map.copyOf(params);
        this.transactionUuid = transactionUuid;
        this.errors = errors == null ? Map.of() : Map.copyOf(errors);
    }

    /** {@code VALIDATION_ERROR} for a single field, e.g. a duplicated unique value. */
    public static BusinessException fieldError(String field, String errorCode) {
        return new BusinessException(
                ErrorCode.VALIDATION_ERROR,
                "Invalid field " + field + ": " + errorCode,
                Map.of(),
                null,
                Map.of(field, errorCode));
    }
}
