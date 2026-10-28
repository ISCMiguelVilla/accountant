package com.devs.accountant.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Expenses of a month grouped by concept: the CONSUMER destination (EXPENSE, DEBT → CONSUMER), the origin (INTEREST)
 * or the fixed "fees" concept ({@code accountId} null) for the fee of NEUTER transactions. Sorted by amount desc.
 */
public record ExpensesByConceptResponse(String month, BigDecimal total, List<Concept> concepts) {

    public record Concept(Long accountId, String name, String icon, String color, BigDecimal amount) {}
}
