package com.devs.accountant.transaction.dto;

import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * Filters of {@code GET /transactions}. {@code accountId} matches origin or destination; dates apply to
 * {@code operation_date} (both ends inclusive, whole days).
 */
public record TransactionFilter(
        List<TransactionType> type,
        OperationType operationType,
        Long accountId,
        Long originId,
        Long destinationId,
        Boolean applied,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
        BigDecimal amountMin,
        BigDecimal amountMax,
        String description,
        UUID batchUuid) {

    public static TransactionFilter ofAccount(Long accountId) {
        return new TransactionFilter(null, null, accountId, null, null, null, null, null, null, null, null, null);
    }
}
