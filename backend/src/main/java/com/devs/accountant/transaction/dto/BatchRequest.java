package com.devs.accountant.transaction.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/**
 * Batch saved atomically. {@code accountVersions} (account id → version) are the versions the client draft was
 * computed with; if any account changed since (another batch, manual balance edit) the batch is rejected with
 * CONFLICT.
 */
public record BatchRequest(
        @NotEmpty @Size(max = 500) List<@Valid TransactionRequest> transactions, Map<Long, Long> accountVersions) {}
