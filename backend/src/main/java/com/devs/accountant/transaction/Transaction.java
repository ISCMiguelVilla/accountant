package com.devs.accountant.transaction;

import com.devs.accountant.account.Account;
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
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Persisted transaction. Never edited nor voided: only a pending one can later be applied, which overwrites the
 * snapshots of the affected side and sets {@code appliedAt}. The amount that counts in reports is computed from
 * {@code operationType}, {@code amount} and {@code fee}; it is not stored.
 */
@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
public class Transaction extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(nullable = false, unique = true, updatable = false)
    private UUID uuid;

    @Column(name = "batch_uuid", nullable = false, updatable = false)
    private UUID batchUuid;

    @Column(name = "schedule_id", updatable = false)
    private Long scheduleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_type", nullable = false, length = 15)
    private OperationType operationType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "origin_account_id", nullable = false)
    private Account origin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_account_id")
    private Account destination;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal fee;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(name = "origin_balance_before", precision = 19, scale = 2)
    private BigDecimal originBalanceBefore;

    @Column(name = "origin_balance_after", precision = 19, scale = 2)
    private BigDecimal originBalanceAfter;

    @Column(name = "destination_balance_before", precision = 19, scale = 2)
    private BigDecimal destinationBalanceBefore;

    @Column(name = "destination_balance_after", precision = 19, scale = 2)
    private BigDecimal destinationBalanceAfter;

    @Column(nullable = false)
    private boolean applied;

    @Column(name = "operation_date", nullable = false)
    private LocalDateTime operationDate;

    /** When the effect was reflected; reports use this date. Null while pending. */
    @Column(name = "applied_at")
    private LocalDateTime appliedAt;
}
