package com.devs.accountant.transaction.engine;

import com.devs.accountant.transaction.OperationType;
import java.math.BigDecimal;

/**
 * Computed values of one transaction: classification and the balance snapshots of each side (null when the account has
 * no balance; {@code before == after} for the side still pending). {@code originDisabled} is set when a temporary
 * account was disabled by its PROFIT.
 */
public record EngineResult(
        EngineTransaction transaction,
        OperationType operationType,
        BigDecimal originBalanceBefore,
        BigDecimal originBalanceAfter,
        BigDecimal destinationBalanceBefore,
        BigDecimal destinationBalanceAfter,
        boolean originDisabled) {

    /** Contribution to income / expense reports (counted once the transaction is applied). */
    public ReportAmounts reportAmounts() {
        return ReportAmounts.of(operationType, transaction.amount(), transaction.fee());
    }
}
