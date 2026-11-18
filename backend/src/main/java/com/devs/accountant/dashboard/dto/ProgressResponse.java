package com.devs.accountant.dashboard.dto;

import com.devs.accountant.dashboard.ProgressStatus;
import java.math.BigDecimal;
import java.util.List;

/**
 * Yearly savings progress (docs/documentacion-tecnica.md §10). Without a goal, {@code target}, {@code expected}, {@code percentage} and
 * the statuses are null. Months after the current one have a null status.
 */
public record ProgressResponse(
        int year,
        BigDecimal target,
        BigDecimal monthlyTarget,
        BigDecimal accumulated,
        BigDecimal expected,
        BigDecimal percentage,
        ProgressStatus status,
        List<Month> months) {

    public record Month(int month, BigDecimal net, ProgressStatus status) {}
}
