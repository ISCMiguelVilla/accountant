package com.devs.accountant.currency.dto;

import com.devs.accountant.currency.CurrencyStatus;
import java.util.List;

/** Filters of {@code GET /admin/currencies}; {@code name} matches name or ISO code. */
public record CurrencyFilter(String name, List<CurrencyStatus> status) {}
