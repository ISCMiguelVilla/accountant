package com.devs.accountant.transaction;

public enum TransactionType {
    /** SUPPLIER → STORAGE. */
    INCOME,
    /** STORAGE or DEBTOR (card purchase) → CONSUMER. */
    EXPENSE,
    /** STORAGE → STORAGE. */
    TRANSFER,
    /** STORAGE, INVESTMENT → INVESTMENT, BUSINESS. */
    INVEST,
    /** INVESTMENT, BUSINESS → STORAGE, INVESTMENT. */
    PROFIT,
    /** Yield; destination optional. */
    DIVIDEND,
    /** Interest/charge on the origin; no destination. */
    INTEREST,
    /** Lend money: STORAGE → CREDITOR. */
    BORROW,
    /** Collect a loan: CREDITOR → STORAGE. */
    COLLECTION,
    /** Take a debt: DEBTOR → STORAGE (cash loan) or CONSUMER (purchase on credit). */
    DEBT,
    /** Pay a debt: STORAGE → DEBTOR. */
    PAYMENT
}
