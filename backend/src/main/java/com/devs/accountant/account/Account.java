package com.devs.accountant.account;

import com.devs.accountant.currency.Currency;
import com.devs.accountant.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "currency_id", nullable = false)
    private Currency currency;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_account_id")
    private Account parent;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountType type;

    /** Null for types without balance (GROUP, SUPPLIER, CONSUMER); never negative. */
    @Column(precision = 19, scale = 2)
    private BigDecimal balance;

    /** DEBTOR only: part of the debt recognized as expense when paid. 0 ≤ pendingExpense ≤ balance. */
    @Column(name = "pending_expense", precision = 19, scale = 2)
    private BigDecimal pendingExpense;

    @Column(length = 50)
    private String icon;

    @Column(length = 7)
    private String color;

    @Column(name = "include_in_balance", nullable = false)
    private boolean includeInBalance = true;

    @Column(name = "is_temporary", nullable = false)
    private boolean temporary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AccountStatus status = AccountStatus.ACTIVE;

    @Version
    @Column(nullable = false)
    private Long version;

    public boolean isDeleted() {
        return status == AccountStatus.DELETED;
    }

    /** Balance treating "no balance" as zero. */
    public BigDecimal balanceOrZero() {
        return balance == null ? BigDecimal.ZERO : balance;
    }
}
