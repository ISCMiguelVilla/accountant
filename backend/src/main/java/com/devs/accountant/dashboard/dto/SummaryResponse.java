package com.devs.accountant.dashboard.dto;

import com.devs.accountant.account.AccountType;
import java.math.BigDecimal;
import java.util.List;

/**
 * Tree of accounts and sub-accounts with balance ({@code assets}); debts (DEBTOR) are reported apart in {@code debt}
 * so they do not add up with the money held. {@code net = assets − debt}.
 */
public record SummaryResponse(BigDecimal assets, BigDecimal debt, BigDecimal net, List<Node> nodes) {

    /** {@code name} may be "parent › child" when a single leaf child was collapsed into its parent. */
    public record Node(
            Long id,
            String name,
            AccountType type,
            String icon,
            String color,
            BigDecimal balance,
            BigDecimal total,
            /** Share of the parent total (of {@code assets} for roots), 0–100. */
            BigDecimal percentage,
            List<Node> children) {}
}
