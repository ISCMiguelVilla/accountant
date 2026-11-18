package com.devs.accountant.calendar;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.calendar.dto.CalendarResponse;
import com.devs.accountant.calendar.dto.CalendarResponse.CreditEvent;
import com.devs.accountant.calendar.dto.CalendarResponse.Kind;
import com.devs.accountant.calendar.dto.CalendarResponse.Scheduled;
import com.devs.accountant.credit.Credit;
import com.devs.accountant.credit.CreditRepository;
import com.devs.accountant.dashboard.DashboardRepository;
import com.devs.accountant.schedule.CronService;
import com.devs.accountant.schedule.Schedule;
import com.devs.accountant.schedule.ScheduleRepository;
import com.devs.accountant.schedule.ScheduleStatus;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Home "Calendar" tab (docs/documentacion-tecnica.md §10). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CalendarService {

    static final int MAX_DAYS = 62;
    static final String INVALID_RANGE = "INVALID_RANGE";
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final DashboardRepository dashboardRepository;
    private final CreditRepository creditRepository;
    private final ScheduleRepository scheduleRepository;
    private final CronService cronService;
    private final CurrentUser currentUser;
    private final Clock clock;

    public CalendarResponse calendar(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from) || ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
            throw BusinessException.fieldError("to", INVALID_RANGE);
        }
        Long userId = currentUser.id();
        LocalDate today = LocalDate.now(clock);

        Map<LocalDate, DashboardRepository.DayAmounts> amounts = new HashMap<>();
        dashboardRepository
                .dailyAmounts(userId, from.atStartOfDay(), to.plusDays(1).atStartOfDay())
                .forEach(day -> amounts.put(day.date(), day));

        Map<LocalDate, List<CreditEvent>> events = new HashMap<>();
        for (Credit credit : creditRepository.findLiveOfUser(userId, AccountStatus.DELETED)) {
            addCreditEvents(events, credit, Kind.CUT_OFF, credit.getCutOffDay(), credit.getCutOffCron(), from, to);
            addCreditEvents(
                    events, credit, Kind.PAYMENT_DUE, credit.getPaymentDueDay(), credit.getPaymentDueCron(), from, to);
        }

        Map<LocalDate, List<Scheduled>> scheduled = new HashMap<>();
        for (Schedule schedule : scheduleRepository.findByUserIdAndStatus(userId, ScheduleStatus.ACTIVE)) {
            var cron = cronService.parse(schedule.getCronExpression(), "cronExpression");
            for (LocalDateTime execution :
                    CronOccurrences.scheduleExecutions(schedule.getNextExecution(), cron, today, from, to)) {
                scheduled
                        .computeIfAbsent(execution.toLocalDate(), key -> new ArrayList<>())
                        .add(new Scheduled(
                                schedule.getId(),
                                schedule.getType(),
                                schedule.getDescription(),
                                schedule.getAmount(),
                                execution.format(TIME)));
            }
        }

        List<CalendarResponse.Day> days = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            DashboardRepository.DayAmounts day = amounts.get(date);
            days.add(new CalendarResponse.Day(
                    date,
                    day == null ? BigDecimal.ZERO : day.income(),
                    day == null ? BigDecimal.ZERO : day.expense(),
                    events.getOrDefault(date, List.of()),
                    scheduled.getOrDefault(date, List.of())));
        }
        return new CalendarResponse(days);
    }

    private void addCreditEvents(
            Map<LocalDate, List<CreditEvent>> events,
            Credit credit,
            Kind kind,
            LocalDate stored,
            String cronExpression,
            LocalDate from,
            LocalDate to) {
        var cron = cronService.parse(cronExpression, "cron");
        var account = credit.getAccount();
        for (LocalDate date : CronOccurrences.creditDates(stored, cron, from, to)) {
            events.computeIfAbsent(date, key -> new ArrayList<>())
                    .add(new CreditEvent(
                            account.getId(), account.getName(), account.getColor(), kind, account.balanceOrZero()));
        }
    }
}
