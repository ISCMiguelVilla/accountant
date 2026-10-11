package com.devs.accountant.credit;

import com.devs.accountant.account.Account;
import com.devs.accountant.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Credit line of a DEBTOR account. {@code cutOffDay} / {@code paymentDueDay} hold the next occurrence (≥ today) of
 * their cron expressions and are advanced by {@link CreditDateJob}.
 */
@Entity
@Table(name = "credits")
@Getter
@Setter
@NoArgsConstructor
public class Credit extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false, unique = true)
    private Account account;

    @Column(name = "credit_limit", nullable = false, precision = 19, scale = 2)
    private BigDecimal creditLimit;

    @Column(name = "cut_off_cron", nullable = false, length = 100)
    private String cutOffCron;

    @Column(name = "payment_due_cron", nullable = false, length = 100)
    private String paymentDueCron;

    @Column(name = "cut_off_day", nullable = false)
    private LocalDate cutOffDay;

    @Column(name = "payment_due_day", nullable = false)
    private LocalDate paymentDueDay;
}
