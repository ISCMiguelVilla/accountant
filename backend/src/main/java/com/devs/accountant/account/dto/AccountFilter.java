package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import java.util.List;

/** Filters of {@code GET /accounts}. Without {@code status}, deleted accounts are excluded. */
public record AccountFilter(
        String name,
        List<AccountType> type,
        List<AccountStatus> status,
        Long parentId,
        Boolean includeInBalance,
        Boolean isTemporary,
        Boolean hasCredit) {}
