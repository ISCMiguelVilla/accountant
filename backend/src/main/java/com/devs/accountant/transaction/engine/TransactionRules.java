package com.devs.accountant.transaction.engine;

import static com.devs.accountant.account.AccountType.BUSINESS;
import static com.devs.accountant.account.AccountType.CONSUMER;
import static com.devs.accountant.account.AccountType.CREDITOR;
import static com.devs.accountant.account.AccountType.DEBTOR;
import static com.devs.accountant.account.AccountType.INVESTMENT;
import static com.devs.accountant.account.AccountType.STORAGE;
import static com.devs.accountant.account.AccountType.SUPPLIER;

import com.devs.accountant.account.AccountType;
import com.devs.accountant.transaction.OperationType;
import com.devs.accountant.transaction.TransactionType;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * The single definition of which accounts each transaction type accepts, which fields are enabled and how it counts
 * in reports. Exposed to the frontend through {@code GET /transactions/rules}; the client never duplicates it.
 */
public final class TransactionRules {

    /** Accounts and flags of one transaction type. */
    public record Rule(
            TransactionType type,
            Set<AccountType> origins,
            Set<AccountType> destinations,
            DestinationMode destinationMode,
            boolean pendingAllowed) {}

    private static final Map<TransactionType, Rule> RULES = new EnumMap<>(TransactionType.class);

    static {
        rule(TransactionType.INCOME, EnumSet.of(SUPPLIER), EnumSet.of(STORAGE), DestinationMode.REQUIRED, false);
        rule(
                TransactionType.EXPENSE,
                EnumSet.of(STORAGE, DEBTOR),
                EnumSet.of(CONSUMER),
                DestinationMode.REQUIRED,
                true);
        rule(TransactionType.TRANSFER, EnumSet.of(STORAGE), EnumSet.of(STORAGE), DestinationMode.REQUIRED, true);
        rule(
                TransactionType.INVEST,
                EnumSet.of(STORAGE, INVESTMENT),
                EnumSet.of(INVESTMENT, BUSINESS),
                DestinationMode.REQUIRED,
                true);
        rule(
                TransactionType.PROFIT,
                EnumSet.of(INVESTMENT, BUSINESS),
                EnumSet.of(STORAGE, INVESTMENT),
                DestinationMode.REQUIRED,
                true);
        Set<AccountType> dividend = EnumSet.of(INVESTMENT, BUSINESS, STORAGE, CREDITOR);
        rule(TransactionType.DIVIDEND, dividend, dividend, DestinationMode.OPTIONAL, false);
        rule(
                TransactionType.INTEREST,
                EnumSet.of(INVESTMENT, BUSINESS, STORAGE, DEBTOR),
                EnumSet.noneOf(AccountType.class),
                DestinationMode.NONE,
                false);
        rule(TransactionType.BORROW, EnumSet.of(STORAGE), EnumSet.of(CREDITOR), DestinationMode.REQUIRED, false);
        rule(TransactionType.COLLECTION, EnumSet.of(CREDITOR), EnumSet.of(STORAGE), DestinationMode.REQUIRED, false);
        rule(TransactionType.DEBT, EnumSet.of(DEBTOR), EnumSet.of(STORAGE, CONSUMER), DestinationMode.REQUIRED, false);
        rule(TransactionType.PAYMENT, EnumSet.of(STORAGE), EnumSet.of(DEBTOR), DestinationMode.REQUIRED, false);
    }

    private TransactionRules() {}

    private static void rule(
            TransactionType type,
            Set<AccountType> origins,
            Set<AccountType> destinations,
            DestinationMode mode,
            boolean pendingAllowed) {
        RULES.put(type, new Rule(type, Set.copyOf(origins), Set.copyOf(destinations), mode, pendingAllowed));
    }

    public static Rule of(TransactionType type) {
        return RULES.get(type);
    }

    public static Map<TransactionType, Rule> all() {
        return Map.copyOf(RULES);
    }

    /** Fee (commission / withholding / charge) is disabled for INTEREST, BORROW, COLLECTION and DEBT → CONSUMER. */
    public static boolean feeEnabled(TransactionType type, AccountType destination) {
        return switch (type) {
            case INTEREST, BORROW, COLLECTION -> false;
            case DEBT -> destination != CONSUMER;
            default -> true;
        };
    }

    /** Where the fee is taken from what the destination receives, it must be strictly lower than the amount. */
    public static boolean feeMustBeBelowAmount(TransactionType type, AccountType destination) {
        return switch (type) {
            case INCOME, TRANSFER, INVEST, PROFIT, DIVIDEND -> true;
            case DEBT -> destination == STORAGE;
            default -> false;
        };
    }

    /**
     * Report classification by type and origin. PAYMENT returns {@code null}: the engine resolves it (SUBTRACTION when
     * part of the payment is recognized as expense, NEUTER otherwise).
     */
    public static OperationType operationType(TransactionType type, AccountType origin) {
        return switch (type) {
            case INCOME, DIVIDEND -> OperationType.ADDITION;
            case EXPENSE, INTEREST -> origin == DEBTOR ? OperationType.NEUTER : OperationType.SUBTRACTION;
            case PAYMENT -> null;
            default -> OperationType.NEUTER;
        };
    }
}
