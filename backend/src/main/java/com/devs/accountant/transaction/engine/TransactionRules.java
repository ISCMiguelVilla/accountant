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
 * The single definition of which accounts each transaction type accepts, which fields are enabled, which side may stay
 * unapplied and how it counts in reports. Exposed to the frontend through {@code GET /transactions/rules}; the client
 * never duplicates it.
 */
public final class TransactionRules {

    /** Accounts and flags of one transaction type. */
    public record Rule(
            TransactionType type,
            Set<AccountType> origins,
            Set<AccountType> destinations,
            DestinationMode destinationMode,
            boolean originPendingAllowed,
            boolean destinationPendingAllowed) {}

    private static final Map<TransactionType, Rule> RULES = new EnumMap<>(TransactionType.class);

    static {
        rule(TransactionType.INCOME, EnumSet.of(SUPPLIER), EnumSet.of(STORAGE), DestinationMode.REQUIRED, false, false);
        // Purchases on credit are DEBT → CONSUMER: every EXPENSE is money really leaving.
        rule(TransactionType.EXPENSE, EnumSet.of(STORAGE), EnumSet.of(CONSUMER), DestinationMode.REQUIRED, true, false);
        rule(TransactionType.TRANSFER, EnumSet.of(STORAGE), EnumSet.of(STORAGE), DestinationMode.REQUIRED, true, true);
        rule(
                TransactionType.INVEST,
                EnumSet.of(STORAGE, INVESTMENT),
                EnumSet.of(INVESTMENT, BUSINESS),
                DestinationMode.REQUIRED,
                true,
                true);
        rule(
                TransactionType.PROFIT,
                EnumSet.of(INVESTMENT, BUSINESS),
                EnumSet.of(STORAGE, INVESTMENT),
                DestinationMode.REQUIRED,
                true,
                true);
        Set<AccountType> dividend = EnumSet.of(INVESTMENT, BUSINESS, STORAGE, CREDITOR);
        rule(TransactionType.DIVIDEND, dividend, dividend, DestinationMode.OPTIONAL, false, true);
        rule(
                TransactionType.INTEREST,
                EnumSet.of(INVESTMENT, BUSINESS, STORAGE, DEBTOR),
                EnumSet.noneOf(AccountType.class),
                DestinationMode.NONE,
                false,
                false);
        rule(TransactionType.BORROW, EnumSet.of(STORAGE), EnumSet.of(CREDITOR), DestinationMode.REQUIRED, false, false);
        rule(
                TransactionType.COLLECTION,
                EnumSet.of(CREDITOR),
                EnumSet.of(STORAGE),
                DestinationMode.REQUIRED,
                false,
                false);
        rule(
                TransactionType.DEBT,
                EnumSet.of(DEBTOR),
                EnumSet.of(STORAGE, CONSUMER),
                DestinationMode.REQUIRED,
                false,
                false);
        rule(TransactionType.PAYMENT, EnumSet.of(STORAGE), EnumSet.of(DEBTOR), DestinationMode.REQUIRED, false, false);
    }

    private TransactionRules() {}

    private static void rule(
            TransactionType type,
            Set<AccountType> origins,
            Set<AccountType> destinations,
            DestinationMode mode,
            boolean originPendingAllowed,
            boolean destinationPendingAllowed) {
        RULES.put(
                type,
                new Rule(
                        type,
                        Set.copyOf(origins),
                        Set.copyOf(destinations),
                        mode,
                        originPendingAllowed,
                        destinationPendingAllowed));
    }

    public static Rule of(TransactionType type) {
        return RULES.get(type);
    }

    /** Fee (commission / tax / charge) is disabled for INTEREST, BORROW, COLLECTION and DEBT → CONSUMER. */
    public static boolean feeEnabled(TransactionType type, AccountType destination) {
        return switch (type) {
            case INTEREST, BORROW, COLLECTION -> false;
            case DEBT -> destination != CONSUMER;
            default -> true;
        };
    }

    /** When the fee is taken from what the destination receives, it must be strictly lower than the amount. */
    public static boolean feeMustBeBelowAmount(TransactionType type, AccountType destination) {
        return switch (type) {
            case INCOME, TRANSFER, INVEST, PROFIT, DIVIDEND -> true;
            case DEBT -> destination == STORAGE;
            default -> false;
        };
    }

    /**
     * Account that pays the fee: the origin pays {@code A + F} in EXPENSE and PAYMENT; otherwise the receiving side
     * gets {@code A − F}. Reports count every fee as an expense on the date this side is applied. Null when the type
     * has no fee.
     */
    public static Side feeSide(TransactionType type, AccountType destination) {
        if (!feeEnabled(type, destination)) {
            return null;
        }
        return switch (type) {
            case EXPENSE, PAYMENT -> Side.ORIGIN;
            case DIVIDEND -> destination == null ? Side.ORIGIN : Side.DESTINATION;
            default -> Side.DESTINATION;
        };
    }

    /**
     * Report classification: ADDITION when money enters my accounts (INCOME, DIVIDEND, cash loan DEBT → STORAGE),
     * SUBTRACTION when it leaves them (EXPENSE, PAYMENT, INTEREST not on a debt), NEUTER when it only moves between my
     * accounts or grows a debt that is paid later.
     */
    public static OperationType operationType(TransactionType type, AccountType origin, AccountType destination) {
        return switch (type) {
            case INCOME, DIVIDEND -> OperationType.ADDITION;
            case EXPENSE, PAYMENT -> OperationType.SUBTRACTION;
            case INTEREST -> origin == DEBTOR ? OperationType.NEUTER : OperationType.SUBTRACTION;
            case DEBT -> destination == STORAGE ? OperationType.ADDITION : OperationType.NEUTER;
            case TRANSFER, INVEST, PROFIT, BORROW, COLLECTION -> OperationType.NEUTER;
        };
    }

    /** Side whose applied date places an income/expense in the reports. */
    public static Side reportSide(OperationType operationType, boolean hasDestination) {
        if (operationType == OperationType.ADDITION && hasDestination) {
            return Side.DESTINATION;
        }
        return Side.ORIGIN;
    }
}
