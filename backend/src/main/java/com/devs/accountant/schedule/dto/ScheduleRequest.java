package com.devs.accountant.schedule.dto;

import com.devs.accountant.transaction.TransactionType;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Create / update a scheduled transaction. Same rules as a normal transaction (matrix, enabled fee). Without
 * {@code nextExecution} the first occurrence of the cron from today is used.
 */
public record ScheduleRequest(
        @NotNull TransactionType type,
        @NotNull Long originAccountId,
        Long destinationAccountId,

        @NotNull @Positive @Digits(integer = 17, fraction = 2)
        BigDecimal amount,

        @PositiveOrZero @Digits(integer = 17, fraction = 2) BigDecimal fee,
        @NotBlank @Size(min = 3, max = 255) String description,
        @NotBlank @Size(max = 100) String cronExpression,
        LocalDateTime nextExecution) {}
