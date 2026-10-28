package com.devs.accountant.calendar.dto;

import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code GET /calendar}: one entry per day of the range. {@code income} / {@code expense} use the 5.3 report amounts
 * of the transactions applied that day (the amount of NEUTER is not included, only its fee as expense).
 */
public record CalendarResponse(List<Day> days) {

    public record Day(
            LocalDate date,
            BigDecimal income,
            BigDecimal expense,
            List<CreditEvent> creditEvents,
            List<Scheduled> scheduled) {}

    /** Cut-off or payment due date of a credit line; {@code balance} is the current debt. */
    public record CreditEvent(Long accountId, String accountName, String color, Kind kind, BigDecimal balance) {}

    public enum Kind {
        CUT_OFF,
        PAYMENT_DUE
    }

    public record Scheduled(
            Long scheduleId, TransactionType type, String description, BigDecimal amount, String time) {}
}
