package com.devs.accountant.dashboard;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/** Period of the income statement, with its window size bounds (PROMPT 6.1). */
public enum Dimension {
    YEAR(2, 4, 2, "1 year"),
    MONTH(3, 12, 6, "1 month"),
    WEEK(4, 12, 4, "1 week"),
    DAY(7, 15, 7, "1 day");

    private final int min;
    private final int max;
    private final int defaultSize;
    /** Postgres interval of one period. */
    private final String interval;

    Dimension(int min, int max, int defaultSize, String interval) {
        this.min = min;
        this.max = max;
        this.defaultSize = defaultSize;
        this.interval = interval;
    }

    public String interval() {
        return interval;
    }

    /** Requested size clamped to the bounds; null → default. */
    public int size(Integer requested) {
        return requested == null ? defaultSize : Math.clamp(requested, min, max);
    }

    /** First day of the period containing {@code date} (weeks start on Monday, as Postgres date_trunc). */
    public LocalDate truncate(LocalDate date) {
        return switch (this) {
            case YEAR -> date.withDayOfYear(1);
            case MONTH -> date.withDayOfMonth(1);
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case DAY -> date;
        };
    }

    public LocalDate plus(LocalDate periodStart, long periods) {
        return switch (this) {
            case YEAR -> periodStart.plusYears(periods);
            case MONTH -> periodStart.plusMonths(periods);
            case WEEK -> periodStart.plusWeeks(periods);
            case DAY -> periodStart.plusDays(periods);
        };
    }

    /** Window of {@code size} periods centered on the reference: floor(size / 2) before it, the rest after. */
    public LocalDate windowStart(LocalDate reference, int size) {
        return plus(truncate(reference), -(size / 2));
    }
}
