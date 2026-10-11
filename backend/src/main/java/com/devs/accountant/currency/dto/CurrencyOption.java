package com.devs.accountant.currency.dto;

/** Lightweight currency used by selects. */
public record CurrencyOption(Long id, String name, String iso, String symbol) {}
