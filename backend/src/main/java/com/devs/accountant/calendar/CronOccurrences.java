package com.devs.accountant.calendar;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.scheduling.support.CronExpression;

/** Expands crons into the dates of a calendar range (docs/documentacion-tecnica.md §10). */
public final class CronOccurrences {

    /** Guard against crons that fire many times a day (every minute, every hour). */
    static final int MAX_PER_SERIES = 100;

    private static final LocalTime END_OF_DAY = LocalTime.of(23, 59, 59);

    private CronOccurrences() {}

    /**
     * Credit dates (cut-off or payment due) in {@code [from, to]}: the stored next date plus the following cron
     * occurrences after it.
     */
    public static List<LocalDate> creditDates(LocalDate stored, CronExpression cron, LocalDate from, LocalDate to) {
        List<LocalDate> dates = new ArrayList<>();
        if (stored == null) {
            return dates;
        }
        LocalDate date = stored;
        while (date != null && !date.isAfter(to) && dates.size() < MAX_PER_SERIES) {
            if (!date.isBefore(from) && (dates.isEmpty() || !dates.getLast().equals(date))) {
                dates.add(date);
            }
            LocalDateTime next = cron.next(date.atTime(END_OF_DAY));
            date = next == null ? null : next.toLocalDate();
        }
        return dates;
    }

    /**
     * Future executions of a schedule in {@code [from, to]}, never before {@code today} (overdue ones are not shown):
     * {@code nextExecution} and the following cron occurrences.
     */
    public static List<LocalDateTime> scheduleExecutions(
            LocalDateTime nextExecution, CronExpression cron, LocalDate today, LocalDate from, LocalDate to) {
        List<LocalDateTime> executions = new ArrayList<>();
        LocalDate lower = from.isAfter(today) ? from : today;
        LocalDateTime cursor = nextExecution;
        if (cursor.toLocalDate().isBefore(lower)) {
            cursor = cron.next(lower.atStartOfDay().minusSeconds(1));
        }
        while (cursor != null && !cursor.toLocalDate().isAfter(to) && executions.size() < MAX_PER_SERIES) {
            executions.add(cursor);
            cursor = cron.next(cursor);
        }
        return executions;
    }
}
