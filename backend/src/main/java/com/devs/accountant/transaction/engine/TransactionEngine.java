package com.devs.accountant.transaction.engine;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure transaction engine (no Spring). Balances change only by adding / subtracting transaction amounts. A batch is
 * applied in {@code operationDate} order (stable by capture order) and the first failure aborts the whole batch.
 *
 * <p>Pending (only EXPENSE, TRANSFER, INVEST, PROFIT): the EXPENSE origin and the TRANSFER / INVEST / PROFIT
 * destination change only when the transaction is applied ({@link #applyPending}). Notation: A = amount, F = fee. See
 * {@code docs/business-rules.md}; {@code docs/transaction-cases.json} holds the cases shared with the TypeScript
 * engine.
 */
public final class TransactionEngine {

    public static final String SAME_ACCOUNT = "SAME_ACCOUNT";
    public static final String ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED";
    public static final String DESTINATION_REQUIRED = "DESTINATION_REQUIRED";
    public static final String DESTINATION_NOT_ALLOWED = "DESTINATION_NOT_ALLOWED";
    public static final String FEE_NOT_ALLOWED = "FEE_NOT_ALLOWED";
    public static final String FEE_NOT_BELOW_AMOUNT = "FEE_NOT_BELOW_AMOUNT";
    public static final String PENDING_NOT_ALLOWED = "PENDING_NOT_ALLOWED";
    public static final String ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND";

    private TransactionEngine() {}

    /** Result of a batch: one result per transaction (date order) and the final account states. */
    public record BatchResult(List<EngineResult> results, Map<Long, EngineAccount> accounts) {

        /** Income / expense of the applied transactions of the batch. */
        public ReportAmounts reportAmounts() {
            return results.stream()
                    .filter(result -> result.transaction().applied())
                    .map(EngineResult::reportAmounts)
                    .reduce(ReportAmounts.zero(), ReportAmounts::plus);
        }
    }

    /** Snapshots of applying a pending transaction later. */
    public record ApplyResult(
            BigDecimal originBalanceBefore,
            BigDecimal originBalanceAfter,
            BigDecimal destinationBalanceBefore,
            BigDecimal destinationBalanceAfter,
            boolean originDisabled) {}

    /**
     * Applies the transactions over copies of {@code accounts} (the inputs are not modified).
     *
     * @throws EngineException with the uuid and request index of the first failing transaction
     */
    public static BatchResult project(Collection<EngineAccount> accounts, List<EngineTransaction> transactions) {
        Map<Long, EngineAccount> state = new LinkedHashMap<>();
        accounts.forEach(account -> state.put(account.id(), account.copy()));

        List<EngineTransaction> ordered = new ArrayList<>(transactions);
        ordered.sort(Comparator.comparing(EngineTransaction::operationDate).thenComparingInt(EngineTransaction::index));

        List<EngineResult> results = new ArrayList<>(ordered.size());
        for (EngineTransaction transaction : ordered) {
            results.add(apply(state, transaction));
        }
        return new BatchResult(results, state);
    }

    /** Applies one transaction to the (mutable) state map. */
    static EngineResult apply(Map<Long, EngineAccount> state, EngineTransaction tx) {
        EngineAccount origin = account(state, tx, tx.originId(), "originAccountId");
        EngineAccount destination =
                tx.destinationId() == null ? null : account(state, tx, tx.destinationId(), "destinationAccountId");
        validate(tx, origin, destination);

        BigDecimal originBefore = origin.balance();
        BigDecimal destinationBefore = destination == null ? null : destination.balance();
        BigDecimal a = tx.amount();
        BigDecimal f = tx.fee();
        boolean originDisabled = false;

        switch (tx.type()) {
            case INCOME -> destination.add(a.subtract(f));
            case EXPENSE -> {
                if (tx.applied()) {
                    debitExpense(tx, origin);
                }
            }
            case TRANSFER, INVEST, PROFIT -> {
                requireFunds(tx, origin, a);
                origin.subtract(a);
                if (tx.applied()) {
                    destination.add(a.subtract(f));
                    originDisabled = disableTemporary(tx, origin);
                }
            }
            case DIVIDEND -> (destination == null ? origin : destination).add(a.subtract(f));
            case INTEREST -> {
                if (origin.type() == AccountType.DEBTOR) {
                    requireCredit(tx, origin, a);
                    origin.add(a);
                } else {
                    requireFunds(tx, origin, a);
                    origin.subtract(a);
                }
            }
            case BORROW -> {
                requireFunds(tx, origin, a);
                origin.subtract(a);
                destination.add(a);
            }
            case COLLECTION -> {
                if (a.compareTo(origin.balance()) > 0) {
                    throw senseless(tx, origin);
                }
                origin.subtract(a);
                destination.add(a);
            }
            case DEBT -> {
                requireCredit(tx, origin, a);
                origin.add(a);
                destination.add(a.subtract(f)); // CONSUMER has no balance: no effect
            }
            case PAYMENT -> {
                requireFunds(tx, origin, a.add(f));
                if (a.compareTo(destination.balance()) > 0) {
                    throw senseless(tx, destination);
                }
                origin.subtract(a.add(f));
                destination.subtract(a);
            }
        }
        OperationType operationType =
                TransactionRules.operationType(tx.type(), destination == null ? null : destination.type());
        return new EngineResult(
                tx,
                operationType,
                originBefore,
                origin.balance(),
                destinationBefore,
                destination == null ? null : destination.balance(),
                originDisabled);
    }

    /**
     * Applies the pending effect of a stored transaction (PATCH /transactions/{id}/apply). Mutates the given accounts.
     * Only EXPENSE and TRANSFER / INVEST / PROFIT can be pending.
     */
    public static ApplyResult applyPending(EngineTransaction tx, EngineAccount origin, EngineAccount destination) {
        BigDecimal originBefore = origin.balance();
        BigDecimal destinationBefore = destination == null ? null : destination.balance();
        boolean originDisabled = false;
        switch (tx.type()) {
            case EXPENSE -> debitExpense(tx, origin);
            case TRANSFER, INVEST, PROFIT -> {
                destination.add(tx.amount().subtract(tx.fee()));
                originDisabled = disableTemporary(tx, origin);
            }
            default ->
                throw new EngineException(
                        EngineError.TRANSACTION_NOT_SUPPORTED, tx.uuid(), tx.index(), null, null, Map.of());
        }
        return new ApplyResult(
                originBefore,
                origin.balance(),
                destinationBefore,
                destination == null ? null : destination.balance(),
                originDisabled);
    }

    /**
     * Validates only the definition of a transaction (rule matrix, enabled fields, active accounts), without balances.
     * Scheduled transactions use it so they follow exactly the same rules as normal ones.
     */
    public static void checkRules(EngineTransaction tx, EngineAccount origin, EngineAccount destination) {
        validate(tx, origin, destination);
    }

    // ---------------------------------------------------------------- effects

    /** EXPENSE origin: STORAGE pays {@code A + F}; a DEBTOR (card purchase) grows its debt by {@code A + F}. */
    private static void debitExpense(EngineTransaction tx, EngineAccount origin) {
        BigDecimal total = tx.amount().add(tx.fee());
        if (origin.type() == AccountType.DEBTOR) {
            requireCredit(tx, origin, total);
            origin.add(total);
        } else {
            requireFunds(tx, origin, total);
            origin.subtract(total);
        }
    }

    /** A PROFIT disables its temporary origin when the transaction is applied (the investment is over). */
    private static boolean disableTemporary(EngineTransaction tx, EngineAccount origin) {
        if (tx.type() == TransactionType.PROFIT && origin.temporary()) {
            origin.disable();
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------ validations

    private static EngineAccount account(Map<Long, EngineAccount> state, EngineTransaction tx, long id, String field) {
        EngineAccount account = state.get(id);
        if (account == null) {
            throw invalid(tx, field, ACCOUNT_NOT_FOUND);
        }
        return account;
    }

    /** Rule matrix, enabled fields and account status. */
    private static void validate(EngineTransaction tx, EngineAccount origin, EngineAccount destination) {
        TransactionRules.Rule rule = TransactionRules.of(tx.type());
        if (destination != null && destination.id() == origin.id()) {
            throw invalid(tx, "destinationAccountId", SAME_ACCOUNT);
        }
        if (!rule.origins().contains(origin.type())) {
            throw invalid(tx, "originAccountId", ORIGIN_NOT_ALLOWED);
        }
        switch (rule.destinationMode()) {
            case REQUIRED -> {
                if (destination == null) {
                    throw invalid(tx, "destinationAccountId", DESTINATION_REQUIRED);
                }
            }
            case NONE -> {
                if (destination != null) {
                    throw invalid(tx, "destinationAccountId", DESTINATION_NOT_ALLOWED);
                }
            }
            case OPTIONAL -> {
                // either way
            }
        }
        if (destination != null && !rule.destinations().contains(destination.type())) {
            throw invalid(tx, "destinationAccountId", DESTINATION_NOT_ALLOWED);
        }
        AccountType destinationType = destination == null ? null : destination.type();
        if (tx.fee().signum() > 0 && !TransactionRules.feeEnabled(tx.type(), destinationType)) {
            throw invalid(tx, "fee", FEE_NOT_ALLOWED);
        }
        if (TransactionRules.feeMustBeBelowAmount(tx.type(), destinationType)
                && tx.fee().compareTo(tx.amount()) >= 0) {
            throw invalid(tx, "fee", FEE_NOT_BELOW_AMOUNT);
        }
        if (!tx.applied() && !rule.pendingAllowed()) {
            throw invalid(tx, "applied", PENDING_NOT_ALLOWED);
        }
        requireActive(tx, origin);
        if (destination != null) {
            requireActive(tx, destination);
        }
    }

    private static void requireActive(EngineTransaction tx, EngineAccount account) {
        if (account.status() != AccountStatus.ACTIVE) {
            throw new EngineException(
                    EngineError.ACCOUNT_DISABLED, tx.uuid(), tx.index(), null, null, Map.of("accountId", account.id()));
        }
    }

    private static void requireFunds(EngineTransaction tx, EngineAccount account, BigDecimal required) {
        if (account.balance().compareTo(required) < 0) {
            throw new EngineException(
                    EngineError.INSUFFICIENT_FUNDS,
                    tx.uuid(),
                    tx.index(),
                    null,
                    null,
                    Map.of(
                            "accountId", account.id(),
                            "available", account.balance().toPlainString(),
                            "required", Money.of(required).toPlainString()));
        }
    }

    /** With a credit line, the debt cannot exceed the limit. */
    private static void requireCredit(EngineTransaction tx, EngineAccount account, BigDecimal increase) {
        if (account.creditLimit() == null) {
            return;
        }
        if (account.balance().add(increase).compareTo(account.creditLimit()) > 0) {
            BigDecimal available =
                    account.creditLimit().subtract(account.balance()).max(BigDecimal.ZERO);
            throw new EngineException(
                    EngineError.CREDIT_LIMIT_EXCEEDED,
                    tx.uuid(),
                    tx.index(),
                    null,
                    null,
                    Map.of(
                            "accountId", account.id(),
                            "available", Money.of(available).toPlainString(),
                            "required", Money.of(increase).toPlainString()));
        }
    }

    private static EngineException senseless(EngineTransaction tx, EngineAccount account) {
        return new EngineException(
                EngineError.SENSELESS_TRANSACTION,
                tx.uuid(),
                tx.index(),
                null,
                null,
                Map.of("accountId", account.id(), "available", account.balance().toPlainString()));
    }

    private static EngineException invalid(EngineTransaction tx, String field, String code) {
        return new EngineException(EngineError.VALIDATION_ERROR, tx.uuid(), tx.index(), field, code, Map.of());
    }
}
