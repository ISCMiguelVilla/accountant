package com.devs.accountant.transaction.engine;

import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Input of the engine. {@code index} is the capture order (stable tie-break for equal dates). {@code applied} false =
 * pending: the pending side (EXPENSE origin; TRANSFER / INVEST / PROFIT destination) changes only when applied.
 */
public record EngineTransaction(
        String uuid,
        int index,
        TransactionType type,
        long originId,
        Long destinationId,
        BigDecimal amount,
        BigDecimal fee,
        boolean applied,
        LocalDateTime operationDate) {

    public EngineTransaction {
        amount = Money.of(amount);
        fee = Money.of(fee == null ? BigDecimal.ZERO : fee);
    }
}
