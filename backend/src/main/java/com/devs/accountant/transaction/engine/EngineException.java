package com.devs.accountant.transaction.engine;

import java.util.Map;

/** Failure of one transaction while computing a batch; carries what the API needs to report it. */
public class EngineException extends RuntimeException {

    private final EngineError error;
    private final String transactionUuid;
    private final int index;
    private final String field;
    private final String fieldCode;
    private final Map<String, Object> params;

    public EngineException(
            EngineError error,
            String transactionUuid,
            int index,
            String field,
            String fieldCode,
            Map<String, Object> params) {
        super(error + (fieldCode == null ? "" : " " + field + "=" + fieldCode) + " at transaction " + transactionUuid);
        this.error = error;
        this.transactionUuid = transactionUuid;
        this.index = index;
        this.field = field;
        this.fieldCode = fieldCode;
        this.params = params == null ? Map.of() : Map.copyOf(params);
    }

    public EngineError getError() {
        return error;
    }

    public String getTransactionUuid() {
        return transactionUuid;
    }

    /** Position of the transaction in the request (not in date order). */
    public int getIndex() {
        return index;
    }

    public String getField() {
        return field;
    }

    public String getFieldCode() {
        return fieldCode;
    }

    public Map<String, Object> getParams() {
        return params;
    }
}
