package com.devs.accountant.transaction.engine;

import com.devs.accountant.transaction.OperationType;
import java.math.BigDecimal;

/**
 * Computed values of one transaction: classification, reported amount and the balance snapshots of each side (null
 * when the account has no balance; {@code before == after} for the side whose effect is still pending).
 */
public record EngineResult(
        EngineTransaction transaction,
        OperationType operationType,
        BigDecimal reportedAmount,
        BigDecimal originBalanceBefore,
        BigDecimal originBalanceAfter,
        BigDecimal destinationBalanceBefore,
        BigDecimal destinationBalanceAfter,
        boolean originDisabled) {}
