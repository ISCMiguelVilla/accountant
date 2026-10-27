package com.devs.accountant.transaction.dto;

import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.currency.dto.CurrencyOption;
import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

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
        String description,
        BigDecimal originBalanceBefore,
        BigDecimal originBalanceAfter,
        BigDecimal destinationBalanceBefore,
        BigDecimal destinationBalanceAfter,
        boolean applied,
        LocalDateTime operationDate,
        LocalDateTime appliedAt,
        LocalDateTime createdAt) {}
