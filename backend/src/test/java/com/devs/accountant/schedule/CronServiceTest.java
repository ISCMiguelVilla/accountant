package com.devs.accountant.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class CronServiceTest {

    private static final ZoneId MX = ZoneId.of("America/Mexico_City");
    private final CronService service = new CronService(
            Clock.fixed(LocalDate.of(2026, 10, 10).atTime(12, 0).atZone(MX).toInstant(), MX));

    @Test
    void checkReturnsTheNextExecutionsIncludingToday() {
        var response = service.check("0 0 0 10 * *", 3);

        assertThat(response.valid()).isTrue();
        assertThat(response.nextExecutions())
                .extracting(dateTime -> dateTime.toLocalDate())
                .containsExactly(LocalDate.of(2026, 10, 10), LocalDate.of(2026, 11, 10), LocalDate.of(2026, 12, 10));
    }

    @Test
    void checkReportsInvalidExpressionsWithoutThrowing() {
        assertThat(service.check("0 0 0 32 * *", 3).valid()).isFalse();
        assertThat(service.check("* * *", 3).valid()).isFalse();
        assertThat(service.check(null, 3).nextExecutions()).isEmpty();
    }

    @Test
    void countIsCapped() {
        assertThat(service.check("0 0 0 * * *", 500).nextExecutions()).hasSize(CronService.MAX_COUNT);
    }

    @Test
    void nextDatesFollowTheExpression() {
        var cron = service.parse("0 0 0 L * *", "cron");

        assertThat(service.nextDates(cron, LocalDate.of(2026, 1, 31), 3))
                .containsExactly(LocalDate.of(2026, 1, 31), LocalDate.of(2026, 2, 28), LocalDate.of(2026, 3, 31));
    }
}
