package com.devs.accountant.transaction.engine;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import java.math.BigDecimal;

/**
 * Mutable in-memory state of an account while the engine works. {@code balance} is null for types without balance;
 * {@code creditLimit} is null when the account has no credit line.
 */
public final class EngineAccount {

    private final long id;
    private final AccountType type;
    private AccountStatus status;
    private BigDecimal balance;
    private final BigDecimal creditLimit;
    private final boolean temporary;

    public EngineAccount(
            long id,
            AccountType type,
            AccountStatus status,
            BigDecimal balance,
            BigDecimal creditLimit,
            boolean temporary) {
        this.id = id;
        this.type = type;
        this.status = status;
        this.balance = type.hasBalance() ? Money.of(balance == null ? BigDecimal.ZERO : balance) : null;
        this.creditLimit = creditLimit == null ? null : Money.of(creditLimit);
        this.temporary = temporary;
    }

    public EngineAccount copy() {
        return new EngineAccount(id, type, status, balance, creditLimit, temporary);
    }

    public long id() {
        return id;
    }

    public AccountType type() {
        return type;
    }

    public AccountStatus status() {
        return status;
    }

    public BigDecimal balance() {
        return balance;
    }

    public BigDecimal creditLimit() {
        return creditLimit;
    }

    public boolean temporary() {
        return temporary;
    }

    void add(BigDecimal amount) {
        if (balance != null) {
            balance = Money.of(balance.add(amount));
        }
    }

    void subtract(BigDecimal amount) {
        if (balance != null) {
            balance = Money.of(balance.subtract(amount));
        }
    }

    void disable() {
        status = AccountStatus.DISABLED;
    }
}
