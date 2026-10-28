package com.devs.accountant.schedule.dto;

import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.currency.dto.CurrencyOption;
import com.devs.accountant.schedule.ScheduleStatus;
import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ScheduleResponse(
        Long id,
        TransactionType type,
        /** Computed from the rules (type and destination type), as the transaction will get it. */
        OperationType operationType,
        AccountRef origin,
        AccountRef destination,
        /** Currency of the origin account (illustrative). */
        CurrencyOption currency,
        BigDecimal amount,
        BigDecimal fee,
        String description,
        String cronExpression,
        LocalDateTime nextExecution,
        LocalDateTime lastExecution,
        ScheduleStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
