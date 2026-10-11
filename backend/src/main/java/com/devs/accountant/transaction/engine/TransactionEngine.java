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
 * Pure transaction engine (no Spring). Projects a batch over the current account states: transactions are applied in
 * {@code operationDate} order (stable by capture order) and the first failure aborts the whole batch.
 *
 * <p>Notation: A = amount, F = fee. The effect of each type, the validations and the report classification follow
 * sections 5.3 / 5.4 of the specification; {@code docs/transaction-cases.json} holds the shared test cases.
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
    public record BatchResult(List<EngineResult> results, Map<Long, EngineAccount> accounts) {}

    /** Result of applying a pending transaction later. */
    public record ApplyResult(
            BigDecimal originBalanceBefore,
            BigDecimal originBalanceAfter,
            BigDecimal destinationBalanceBefore,
            BigDecimal destinationBalanceAfter) {}

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
        OperationType operationType = TransactionRules.operationType(tx.type(), origin.type());
        BigDecimal reported = Money.zero();
        boolean originDisabled = false;

        switch (tx.type()) {
            case INCOME -> {
                destination.add(a.subtract(f));
                reported = a.subtract(f);
            }
            case EXPENSE -> {
                BigDecimal total = a.add(f);
                if (origin.type() == AccountType.DEBTOR) {
                    requireCredit(tx, origin, total);
                    if (tx.applied()) {
                        origin.add(total);
                        origin.addPendingExpense(total);
                    }
                } else {
                    reported = total;
                    if (tx.applied()) {
                        requireFunds(tx, origin, total);
                        origin.subtract(total);
                    }
                }
            }
            case TRANSFER, INVEST, PROFIT -> {
                requireFunds(tx, origin, a);
                origin.subtract(a);
                if (tx.applied()) {
                    destination.add(a.subtract(f));
                }
                if (tx.type() == TransactionType.PROFIT && origin.temporary()) {
                    origin.disable();
                    originDisabled = true;
                }
            }
            case DIVIDEND -> {
                (destination == null ? origin : destination).add(a.subtract(f));
                reported = a.subtract(f);
            }
            case INTEREST -> {
                if (origin.type() == AccountType.DEBTOR) {
                    requireCredit(tx, origin, a);
                    origin.add(a);
                    origin.addPendingExpense(a);
                } else {
                    requireFunds(tx, origin, a);
                    origin.subtract(a);
                    reported = a;
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
                if (destination.type() == AccountType.STORAGE) {
                    destination.add(a.subtract(f));
                    // A cash loan is not an expense; its commission is a cost to recognize when paid.
                    origin.addPendingExpense(f);
                } else {
                    // Purchase on credit: consumption recognized as expense when paid.
                    origin.addPendingExpense(a);
                }
            }
            case PAYMENT -> {
                requireFunds(tx, origin, a.add(f));
                if (a.compareTo(destination.balance()) > 0) {
                    throw senseless(tx, destination);
                }
                origin.subtract(a.add(f));
                destination.subtract(a);
                BigDecimal recognized = a.min(destination.pendingExpense());
                destination.subtractPendingExpense(recognized);
                reported = f.add(recognized);
                operationType = reported.signum() > 0 ? OperationType.SUBTRACTION : OperationType.NEUTER;
            }
        }
        return new EngineResult(
                tx,
                operationType,
                Money.of(reported),
                originBefore,
                origin.balance(),
                destinationBefore,
                destination == null ? null : destination.balance(),
                originDisabled);
    }

    /**
     * Applies the pending side of a stored transaction (PATCH /transactions/{id}/apply). Mutates the given accounts.
     * Only EXPENSE (both origins) and TRANSFER / INVEST / PROFIT can be pending.
     */
    public static ApplyResult applyPending(EngineTransaction tx, EngineAccount origin, EngineAccount destination) {
        BigDecimal a = tx.amount();
        BigDecimal f = tx.fee();
        BigDecimal originBefore = origin.balance();
        BigDecimal destinationBefore = destination == null ? null : destination.balance();
        switch (tx.type()) {
            case TRANSFER, INVEST, PROFIT -> destination.add(a.subtract(f));
            case EXPENSE -> {
                BigDecimal total = a.add(f);
                if (origin.type() == AccountType.DEBTOR) {
                    requireCredit(tx, origin, total);
                    origin.add(total);
                    origin.addPendingExpense(total);
                } else {
                    requireFunds(tx, origin, total);
                    origin.subtract(total);
                }
            }
            default ->
                throw new EngineException(
                        EngineError.TRANSACTION_NOT_SUPPORTED, tx.uuid(), tx.index(), null, null, Map.of());
        }
        return new ApplyResult(
                originBefore, origin.balance(), destinationBefore, destination == null ? null : destination.balance());
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
