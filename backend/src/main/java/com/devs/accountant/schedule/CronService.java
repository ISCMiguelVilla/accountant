package com.devs.accountant.schedule;

import com.devs.accountant.schedule.dto.CronCheckResponse;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

/** Spring (6 field) cron helpers shared by credits, scheduled transactions and the calendar. */
@Service
@RequiredArgsConstructor
public class CronService {

    public static final String INVALID_CRON = "INVALID_CRON";
    static final int MAX_COUNT = 10;
    private static final LocalTime END_OF_DAY = LocalTime.of(23, 59, 59);

    private final Clock clock;

    /** Parses an expression or throws {@code INVALID_CRON} bound to the given request field. */
    public CronExpression parse(String expression, String field) {
        try {
            return CronExpression.parse(expression == null ? "" : expression.trim());
        } catch (IllegalArgumentException ex) {
            throw invalid(field);
        }
    }

    /** First occurrence on or after {@code date} (the date itself counts if it matches). */
    public LocalDate nextOnOrAfter(CronExpression cron, LocalDate date, String field) {
        LocalDateTime next = cron.next(date.minusDays(1).atTime(END_OF_DAY));
        if (next == null) {
            throw invalid(field);
        }
        return next.toLocalDate();
    }

    /** Next occurrences (as dates) starting today, today included. */
    public List<LocalDate> nextDates(CronExpression cron, LocalDate from, int count) {
        List<LocalDate> dates = new ArrayList<>();
        LocalDateTime cursor = from.minusDays(1).atTime(END_OF_DAY);
        while (dates.size() < count) {
            LocalDateTime next = cron.next(cursor);
            if (next == null) {
                break;
            }
            dates.add(next.toLocalDate());
            cursor = next;
        }
        return dates;
    }

    /** {@code GET /schedules/cron/check}: never throws, reports validity and the next executions. */
    public CronCheckResponse check(String expression, int count) {
        int size = Math.clamp(count, 1, MAX_COUNT);
        try {
            CronExpression cron = CronExpression.parse(expression == null ? "" : expression.trim());
            List<LocalDateTime> executions = new ArrayList<>();
            LocalDateTime cursor = LocalDate.now(clock).minusDays(1).atTime(END_OF_DAY);
            while (executions.size() < size) {
                LocalDateTime next = cron.next(cursor);
                if (next == null) {
                    break;
                }
                executions.add(next);
                cursor = next;
            }
            return new CronCheckResponse(!executions.isEmpty(), executions);
        } catch (IllegalArgumentException ex) {
            return new CronCheckResponse(false, List.of());
        }
    }

    private static BusinessException invalid(String field) {
        return new BusinessException(
                ErrorCode.INVALID_CRON,
                "Invalid cron expression",
                Map.of("field", field),
                null,
                Map.of(field, INVALID_CRON));
    }
}
