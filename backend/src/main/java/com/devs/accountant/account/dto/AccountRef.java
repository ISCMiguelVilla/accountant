package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountType;

/** Minimal account reference (parent, selects). */
public record AccountRef(Long id, String name, AccountType type) {}
