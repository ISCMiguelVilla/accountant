package com.devs.accountant.currency;

import com.devs.accountant.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Global currency catalog. The currency of an account is illustrative only (no conversions). */
@Entity
@Table(name = "currencies")
@Getter
@Setter
@NoArgsConstructor
public class Currency extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50, unique = true)
    private String name;

    @Column(nullable = false, length = 3, unique = true)
    private String iso;

    @Column(nullable = false, length = 5)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CurrencyStatus status = CurrencyStatus.ACTIVE;
}
