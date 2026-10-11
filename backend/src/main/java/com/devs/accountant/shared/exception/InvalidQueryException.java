package com.devs.accountant.shared.exception;

import java.util.Map;

/** A query parameter (paging, sort or filter) is not allowed or has an invalid value. */
public class InvalidQueryException extends BusinessException {

    public static final String CODE = "INVALID_QUERY_PARAMETER";

    public InvalidQueryException(String parameter) {
        super(
                ErrorCode.VALIDATION_ERROR,
                "Invalid query parameter: " + parameter,
                Map.of("parameter", parameter),
                null,
                Map.of(parameter, CODE));
    }
}
