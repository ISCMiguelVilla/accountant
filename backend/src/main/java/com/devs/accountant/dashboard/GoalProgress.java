package com.devs.accountant.dashboard;

import com.devs.accountant.dashboard.dto.ProgressResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Yearly progress against the savings goal (docs/documentacion-tecnica.md §10). */
public final class GoalProgress {

    private static final BigDecimal TWELVE = BigDecimal.valueOf(12);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal HALF = new BigDecimal("0.5");

    private GoalProgress() {}

    /**
     * @param target goal of the year, null when there is none
     * @param netByMonth month (1–12) → net (income − expense) of the applied transactions
     */
    public static ProgressResponse of(
            int year, BigDecimal target, Map<Integer, BigDecimal> netByMonth, LocalDate today) {
        int elapsed = year < today.getYear() ? 12 : year == today.getYear() ? today.getMonthValue() : 0;
        BigDecimal monthlyTarget = target == null ? null : target.divide(TWELVE, 2, RoundingMode.HALF_UP);

        List<ProgressResponse.Month> months = new ArrayList<>(12);
        BigDecimal accumulated = BigDecimal.ZERO.setScale(2);
        for (int month = 1; month <= 12; month++) {
            BigDecimal net = netByMonth.getOrDefault(month, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            accumulated = accumulated.add(net);
            ProgressStatus status = monthlyTarget == null || month > elapsed ? null : monthStatus(net, monthlyTarget);
            months.add(new ProgressResponse.Month(month, net, status));
        }
        if (target == null) {
            return new ProgressResponse(year, null, null, accumulated, null, null, null, months);
        }
        BigDecimal expected = target.multiply(BigDecimal.valueOf(elapsed)).divide(TWELVE, 2, RoundingMode.HALF_UP);
        BigDecimal percentage = accumulated
                .multiply(HUNDRED)
                .divide(target, 2, RoundingMode.HALF_UP)
                .max(BigDecimal.ZERO.setScale(2))
                .min(HUNDRED.setScale(2));
        ProgressStatus status;
        if (accumulated.compareTo(expected) >= 0) {
            status = ProgressStatus.SUCCESS;
        } else if (accumulated.compareTo(expected.multiply(HALF)) >= 0) {
            status = ProgressStatus.WARNING;
        } else {
            status = ProgressStatus.DANGER;
        }
        return new ProgressResponse(year, target, monthlyTarget, accumulated, expected, percentage, status, months);
    }

    private static ProgressStatus monthStatus(BigDecimal net, BigDecimal monthlyTarget) {
        if (net.compareTo(monthlyTarget) >= 0) {
            return ProgressStatus.SUCCESS;
        }
        return net.signum() >= 0 ? ProgressStatus.WARNING : ProgressStatus.DANGER;
    }
}
