package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.credit.dto.CreditResponse;
import com.devs.accountant.currency.dto.CurrencyOption;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AccountResponse(
        Long id,
        String name,
        AccountType type,
        AccountStatus status,
        BigDecimal balance,
        CurrencyOption currency,
        AccountRef parent,
        String icon,
        String color,
        boolean includeInBalance,
        boolean temporary,
        Long version,
        CreditResponse credit,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
