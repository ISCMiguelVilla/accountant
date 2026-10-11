package com.devs.accountant.transaction.engine;

/** Codes raised by the engine; same names as the API error codes (and the TypeScript engine). */
public enum EngineError {
    /** Rule matrix / enabled fields violation; detailed by {@link EngineException#getField()} + field code. */
    VALIDATION_ERROR,
    INSUFFICIENT_FUNDS,
    SENSELESS_TRANSACTION,
    CREDIT_LIMIT_EXCEEDED,
    ACCOUNT_DISABLED,
    TRANSACTION_NOT_SUPPORTED
}
