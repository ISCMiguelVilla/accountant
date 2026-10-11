package com.devs.accountant.account.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/** Account plus what the form/detail need to know to enforce the type and delete rules. */
public record AccountDetailResponse(
        @JsonUnwrapped AccountResponse account, boolean hasChildren, boolean hasTransactions) {}
