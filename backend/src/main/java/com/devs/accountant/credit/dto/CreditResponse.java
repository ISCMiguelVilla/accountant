package com.devs.accountant.credit.dto;

import com.devs.accountant.credit.Credit;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Credit line plus derived values (not persisted): {@code availableCredit = limit − balance} (never below 0) and
 * {@code usagePercentage = balance / limit × 100}.
 */
public record CreditResponse(
        BigDecimal creditLimit,
        String cutOffCron,
        String paymentDueCron,
        LocalDate cutOffDay,
        LocalDate paymentDueDay,
        BigDecimal availableCredit,
        BigDecimal usagePercentage) {

    public static CreditResponse of(Credit credit, BigDecimal balance) {
        BigDecimal used = balance == null ? BigDecimal.ZERO : balance;
        BigDecimal limit = credit.getCreditLimit();
        BigDecimal available = limit.subtract(used).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal usage = used.multiply(BigDecimal.valueOf(100)).divide(limit, 2, RoundingMode.HALF_UP);
        return new CreditResponse(
                limit,
                credit.getCutOffCron(),
                credit.getPaymentDueCron(),
                credit.getCutOffDay(),
                credit.getPaymentDueDay(),
                available,
                usage);
    }
}
