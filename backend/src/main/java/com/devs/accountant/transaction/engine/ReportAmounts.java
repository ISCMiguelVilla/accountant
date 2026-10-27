package com.devs.accountant.transaction.engine;

import com.devs.accountant.transaction.OperationType;
import java.math.BigDecimal;

/**
 * Amounts a transaction contributes to the reports. They are not persisted: report queries compute them the same way.
 *
 * <ul>
 *   <li>ADDITION → income {@code amount − fee} (what was really received);
 *   <li>SUBTRACTION → expense {@code amount + fee} (what really left or is owed);
 *   <li>NEUTER → only its {@code fee} is an expense (real money lost); the amount does not count.
 * </ul>
 */
public record ReportAmounts(BigDecimal income, BigDecimal expense) {

    public static ReportAmounts of(OperationType operationType, BigDecimal amount, BigDecimal fee) {
        BigDecimal f = fee == null ? BigDecimal.ZERO : fee;
        return switch (operationType) {
            case ADDITION -> new ReportAmounts(Money.of(amount.subtract(f)), Money.zero());
            case SUBTRACTION -> new ReportAmounts(Money.zero(), Money.of(amount.add(f)));
            case NEUTER -> new ReportAmounts(Money.zero(), Money.of(f));
        };
    }

    public ReportAmounts plus(ReportAmounts other) {
        return new ReportAmounts(Money.of(income.add(other.income)), Money.of(expense.add(other.expense)));
    }

    public BigDecimal net() {
        return Money.of(income.subtract(expense));
    }

    public static ReportAmounts zero() {
        return new ReportAmounts(Money.zero(), Money.zero());
    }
}
