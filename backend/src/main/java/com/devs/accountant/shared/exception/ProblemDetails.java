package com.devs.accountant.shared.exception;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;

/** Builds RFC 7807 {@link ProblemDetail} bodies with the properties the frontend relies on. */
@Component
@RequiredArgsConstructor
public class ProblemDetails {

    public static final String CODE = "code";
    public static final String TIMESTAMP = "timestamp";
    public static final String PARAMS = "params";
    public static final String ERRORS = "errors";
    public static final String TRANSACTION_UUID = "transactionUuid";

    private final Clock clock;

    public ProblemDetail of(ErrorCode code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(code.status(), detail);
        problem.setTitle(code.name());
        problem.setProperty(CODE, code.name());
        problem.setProperty(TIMESTAMP, OffsetDateTime.now(clock).toString());
        return problem;
    }

    public ProblemDetail of(BusinessException ex) {
        ProblemDetail problem = of(ex.getCode(), ex.getMessage());
        if (!ex.getParams().isEmpty()) {
            problem.setProperty(PARAMS, ex.getParams());
        }
        if (ex.getTransactionUuid() != null) {
            problem.setProperty(TRANSACTION_UUID, ex.getTransactionUuid());
        }
        if (!ex.getErrors().isEmpty()) {
            problem.setProperty(ERRORS, ex.getErrors());
        }
        return problem;
    }

    public ProblemDetail validation(Map<String, String> errors) {
        ProblemDetail problem = of(ErrorCode.VALIDATION_ERROR, "Request validation failed");
        problem.setProperty(ERRORS, errors);
        return problem;
    }

    /** Completes a framework generated problem (status already set) with the standard properties. */
    public ProblemDetail enrich(ProblemDetail problem) {
        if (problem.getProperties() == null || !problem.getProperties().containsKey(CODE)) {
            ErrorCode code = ErrorCode.fromStatus(problem.getStatus());
            problem.setTitle(code.name());
            problem.setProperty(CODE, code.name());
        }
        problem.setProperty(TIMESTAMP, OffsetDateTime.now(clock).toString());
        return problem;
    }
}
