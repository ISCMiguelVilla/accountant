package com.devs.accountant.transaction.dto;

import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.currency.dto.CurrencyOption;
import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** {@code destinationApplied} / {@code destinationAppliedAt} are null when there is no destination. */
public record TransactionResponse(
        Long id,
        UUID uuid,
        UUID batchUuid,
        Long scheduleId,
        TransactionType type,
        OperationType operationType,
        AccountRef origin,
        AccountRef destination,
        /** Currency of the origin account (illustrative). */
        CurrencyOption currency,
        BigDecimal amount,
        BigDecimal fee,
        BigDecimal reportedAmount,
        String description,
        BigDecimal originBalanceBefore,
        BigDecimal originBalanceAfter,
        BigDecimal destinationBalanceBefore,
        BigDecimal destinationBalanceAfter,
        LocalDateTime operationDate,
        boolean originApplied,
        LocalDateTime originAppliedAt,
        Boolean destinationApplied,
        LocalDateTime destinationAppliedAt,
        boolean fullyApplied,
        LocalDateTime createdAt) {}
