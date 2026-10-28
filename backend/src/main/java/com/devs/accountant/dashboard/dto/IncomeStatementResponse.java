package com.devs.accountant.dashboard.dto;

import com.devs.accountant.dashboard.Dimension;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Income (ADDITION: amount − fee) and expense (SUBTRACTION: amount + fee, plus the fee of NEUTER) per period, by
 * {@code applied_at}. Periods without data come with 0.
 */
public record IncomeStatementResponse(Dimension dimension, int size, LocalDate reference, List<Period> periods) {

    public record Period(LocalDate start, BigDecimal income, BigDecimal expense, BigDecimal net) {}
}
