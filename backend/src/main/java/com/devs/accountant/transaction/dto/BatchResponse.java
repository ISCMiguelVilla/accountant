package com.devs.accountant.transaction.dto;

import java.util.List;
import java.util.UUID;

/** Saved batch: its uuid and the persisted transactions in application (date) order. */
public record BatchResponse(UUID batchUuid, List<TransactionResponse> transactions) {}
