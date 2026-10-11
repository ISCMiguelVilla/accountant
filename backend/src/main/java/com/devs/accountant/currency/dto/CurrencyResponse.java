package com.devs.accountant.currency.dto;

import com.devs.accountant.currency.CurrencyStatus;
import java.time.LocalDateTime;

public record CurrencyResponse(
        Long id,
        String name,
        String iso,
        String symbol,
        CurrencyStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
