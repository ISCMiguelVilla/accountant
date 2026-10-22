package com.devs.accountant.transaction.engine;

import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Input of the engine. {@code index} is the capture order (stable tie-break for equal dates). {@code originApplied} /
 * {@code destinationApplied} say whether the amount is already reflected on each side; {@code destinationApplied} is
 * null when there is no destination.
 */
public record EngineTransaction(
        String uuid,
        int index,
        TransactionType type,
        long originId,
        Long destinationId,
        BigDecimal amount,
        BigDecimal fee,
        boolean originApplied,
        Boolean destinationApplied,
        LocalDateTime operationDate) {

    public EngineTransaction {
        amount = Money.of(amount);
        fee = Money.of(fee == null ? BigDecimal.ZERO : fee);
        destinationApplied = destinationId == null ? null : (destinationApplied == null || destinationApplied);
    }

    public boolean isApplied(Side side) {
        return side == Side.ORIGIN ? originApplied : Boolean.TRUE.equals(destinationApplied);
    }
}
