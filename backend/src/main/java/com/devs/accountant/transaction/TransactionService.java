package com.devs.accountant.transaction;

import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.transaction.dto.BatchRequest;
import com.devs.accountant.transaction.dto.BatchResponse;
import com.devs.accountant.transaction.dto.TransactionFilter;
import com.devs.accountant.transaction.dto.TransactionResponse;
import com.devs.accountant.transaction.dto.TransactionRulesResponse;

public interface TransactionService {

    TransactionRulesResponse rules();

    PageResponse<TransactionResponse> findAll(TransactionFilter filter, PageParams params);

    /** Latest transactions where the account is origin or destination (default 10, newest first). */
    PageResponse<TransactionResponse> findByAccount(Long accountId, PageParams params);

    TransactionResponse findById(Long id);

    /** Validates, computes and persists the whole batch in one database transaction (all or nothing). */
    BatchResponse saveBatch(BatchRequest request);

    /** Reflects the pending effect of a transaction; idempotent. */
    TransactionResponse apply(Long id);
}
