package com.devs.accountant.currency.dto;

import com.devs.accountant.currency.CurrencyStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CurrencyRequest(
        @NotBlank @Size(min = 2, max = 50) String name,
        @NotBlank @Pattern(regexp = "^[A-Za-z]{3}$") String iso,
        @NotBlank @Size(max = 5) String symbol,
        @NotNull CurrencyStatus status) {}
