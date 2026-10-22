package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.credit.dto.CreditResponse;
import com.devs.accountant.currency.dto.CurrencyOption;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Lightweight usable account (ACTIVE, not GROUP) for the transaction editor: everything the client engine needs to
 * project balances ({@code version} detects base changes, {@code lastOperationDate} is the minimum date allowed).
 */
public record AccountOption(
        Long id,
        String name,
        AccountType type,
        AccountStatus status,
        Long parentId,
        BigDecimal balance,
        CurrencyOption currency,
        String icon,
        String color,
        boolean temporary,
        Long version,
        LocalDateTime lastOperationDate,
        CreditResponse credit) {}
