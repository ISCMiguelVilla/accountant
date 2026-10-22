package com.devs.accountant.account;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;

/** Account types, whether they hold a balance and which sub-account types they accept. */
public enum AccountType {
    /** Hierarchical grouping; never used in transactions. */
    GROUP(false),
    /** Income source (employer, client). */
    SUPPLIER(false),
    /** Where money is kept (bank, cash). */
    STORAGE(true),
    /** Expense concept (food, home). */
    CONSUMER(false),
    /** Own business. */
    BUSINESS(true),
    INVESTMENT(true),
    /** Money I lent; balance = what I am owed. */
    CREDITOR(true),
    /** Money I owe (card, loan); balance = debt. May have a credit line. */
    DEBTOR(true);

    private final boolean hasBalance;

    AccountType(boolean hasBalance) {
        this.hasBalance = hasBalance;
    }

    public boolean hasBalance() {
        return hasBalance;
    }

    public Set<AccountType> allowedChildren() {
        return switch (this) {
            case GROUP -> EnumSet.allOf(AccountType.class);
            case SUPPLIER -> EnumSet.of(SUPPLIER);
            case STORAGE -> EnumSet.of(STORAGE, INVESTMENT, DEBTOR);
            case CONSUMER -> EnumSet.of(CONSUMER);
            case BUSINESS -> EnumSet.of(STORAGE, INVESTMENT);
            case INVESTMENT -> EnumSet.of(INVESTMENT);
            case CREDITOR -> EnumSet.of(CREDITOR);
            case DEBTOR -> EnumSet.of(DEBTOR);
        };
    }

    public boolean accepts(AccountType child) {
        return allowedChildren().contains(child);
    }

    /** Types that may be the parent of {@code child}. */
    public static Set<AccountType> parentTypesOf(AccountType child) {
        Set<AccountType> parents = EnumSet.noneOf(AccountType.class);
        Arrays.stream(values()).filter(type -> type.accepts(child)).forEach(parents::add);
        return parents;
    }

    /** Only the types that can be the origin of a PROFIT can be temporary. */
    public boolean canBeTemporary() {
        return this == INVESTMENT || this == BUSINESS;
    }

    /** Usable in transactions (when ACTIVE). */
    public boolean isTransactional() {
        return this != GROUP;
    }
}
