package com.devs.accountant.calendar;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.support.CronExpression;

class CronOccurrencesTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 27);
    private static final CronExpression DAY_15 = CronExpression.parse("0 0 0 15 * *");

    @Test
    void creditDatesStartAtTheStoredDateAndFollowTheCron() {
        // Visible range of November (with padding) and December.
        assertThat(CronOccurrences.creditDates(
                        LocalDate.of(2026, 11, 15), DAY_15, LocalDate.of(2026, 10, 26), LocalDate.of(2026, 12, 31)))
                .containsExactly(LocalDate.of(2026, 11, 15), LocalDate.of(2026, 12, 15));
        // The stored date can be outside (before) the range.
        assertThat(CronOccurrences.creditDates(
                        LocalDate.of(2026, 11, 15), DAY_15, LocalDate.of(2027, 1, 1), LocalDate.of(2027, 1, 31)))
                .containsExactly(LocalDate.of(2027, 1, 15));
        // A stored date after the range gives nothing.
        assertThat(CronOccurrences.creditDates(
                        LocalDate.of(2026, 11, 15), DAY_15, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31)))
                .isEmpty();
    }

    @Test
    void lastDayOfMonthCron() {
        assertThat(CronOccurrences.creditDates(
                        LocalDate.of(2026, 10, 31),
                        CronExpression.parse("0 0 0 L * *"),
                        LocalDate.of(2026, 10, 1),
                        LocalDate.of(2026, 12, 1)))
                .containsExactly(LocalDate.of(2026, 10, 31), LocalDate.of(2026, 11, 30));
    }

    @Test
    void scheduleExecutionsAreOnlyFromTodayOn() {
        // Overdue next execution (the 15th): the calendar starts from today.
        var executions = CronOccurrences.scheduleExecutions(
                LocalDateTime.of(2026, 10, 15, 0, 0),
                CronExpression.parse("0 0 9 * * MON"),
                TODAY,
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 11, 15));

        assertThat(executions)
                .containsExactly(LocalDateTime.of(2026, 11, 2, 9, 0), LocalDateTime.of(2026, 11, 9, 9, 0));
    }

    @Test
    void scheduleExecutionsStartAtTheNextExecution() {
        var executions = CronOccurrences.scheduleExecutions(
                LocalDateTime.of(2026, 12, 15, 0, 0),
                DAY_15,
                TODAY,
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2027, 1, 31));

        assertThat(executions)
                .containsExactly(LocalDateTime.of(2026, 12, 15, 0, 0), LocalDateTime.of(2027, 1, 15, 0, 0));
    }

    @Test
    void manyTimesADayCronsAreCapped() {
        var executions = CronOccurrences.scheduleExecutions(
                TODAY.atStartOfDay(), CronExpression.parse("0 * * * * *"), TODAY, TODAY, TODAY.plusDays(5));

        assertThat(executions).hasSize(CronOccurrences.MAX_PER_SERIES);
    }
}
