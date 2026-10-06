package com.devs.accountant.shared.exception;

import org.springframework.http.HttpStatus;

/** Error codes returned in the {@code code} property of every {@code ProblemDetail}. */
public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST),
    INVALID_CRON(HttpStatus.BAD_REQUEST),
    BAD_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND),
    CONFLICT(HttpStatus.CONFLICT),
    INSUFFICIENT_FUNDS(HttpStatus.UNPROCESSABLE_CONTENT),
    SENSELESS_TRANSACTION(HttpStatus.UNPROCESSABLE_CONTENT),
    TRANSACTION_NOT_SUPPORTED(HttpStatus.UNPROCESSABLE_CONTENT),
    CREDIT_LIMIT_EXCEEDED(HttpStatus.UNPROCESSABLE_CONTENT),
    DATE_BEFORE_LAST_TRANSACTION(HttpStatus.UNPROCESSABLE_CONTENT),
    ACCOUNT_DISABLED(HttpStatus.UNPROCESSABLE_CONTENT),
    ACCOUNT_NOT_DELETABLE(HttpStatus.UNPROCESSABLE_CONTENT),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    /** Maps a raw HTTP status (from framework exceptions) to the closest code. */
    public static ErrorCode fromStatus(int status) {
        return switch (status) {
            case 401 -> BAD_CREDENTIALS;
            case 403 -> FORBIDDEN;
            case 404, 405 -> RESOURCE_NOT_FOUND;
            case 409 -> CONFLICT;
            default -> status >= 500 ? INTERNAL_SERVER_ERROR : MALFORMED_REQUEST;
        };
    }
}
