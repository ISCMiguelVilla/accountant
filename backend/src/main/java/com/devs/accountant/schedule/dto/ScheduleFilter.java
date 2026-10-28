package com.devs.accountant.schedule.dto;

import com.devs.accountant.schedule.ScheduleStatus;
import com.devs.accountant.transaction.TransactionType;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * Filters of {@code GET /schedules}. Without {@code status}, deleted schedules are excluded; {@code accountId} matches
 * origin or destination; the dates apply to {@code next_execution} (whole days, both ends inclusive).
 */
public record ScheduleFilter(
        List<TransactionType> type,
        List<ScheduleStatus> status,
        Long accountId,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate nextExecutionFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate nextExecutionTo,
        String description) {}
