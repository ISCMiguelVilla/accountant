package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountType;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.Set;

/** Account plus what the form/detail need to enforce the type and delete rules. */
public record AccountDetailResponse(
        @JsonUnwrapped AccountResponse account,
        boolean hasChildren,
        Set<AccountType> childTypes,
        boolean hasTransactions) {}
