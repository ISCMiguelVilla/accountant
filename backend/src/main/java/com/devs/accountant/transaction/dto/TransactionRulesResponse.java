package com.devs.accountant.transaction.dto;

import com.devs.accountant.account.AccountType;
import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import com.devs.accountant.transaction.engine.DestinationMode;
import com.devs.accountant.transaction.engine.Side;
import java.util.List;

/**
 * {@code GET /transactions/rules}: the rule matrix the frontend uses for selectors and enabled fields. The client
 * only implements the arithmetic; this is the single definition of the rules.
 */
public record TransactionRulesResponse(List<TypeRule> types) {

    /** {@code originPendingAllowed} / {@code destinationPendingAllowed}: which side may stay unapplied. */
    public record TypeRule(
            TransactionType type,
            List<AccountType> origins,
            List<AccountType> destinations,
            DestinationMode destinationMode,
            boolean originPendingAllowed,
            boolean destinationPendingAllowed,
            List<Variant> variants) {}

    /**
     * One origin type / destination type combination ({@code destination} null = no destination). {@code feeSide} is
     * the account that pays the fee (null when the fee is disabled); reports count the fee as an expense.
     */
    public record Variant(
            AccountType origin,
            AccountType destination,
            OperationType operationType,
            boolean feeEnabled,
            boolean feeMustBeBelowAmount,
            Side feeSide) {}
}
