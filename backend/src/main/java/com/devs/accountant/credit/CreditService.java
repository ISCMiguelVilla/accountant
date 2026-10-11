package com.devs.accountant.credit;

import com.devs.accountant.credit.dto.CreditRequest;
import com.devs.accountant.credit.dto.CreditResponse;

public interface CreditService {

    /** Creates or replaces the credit line of a DEBTOR account and recomputes its next dates. */
    CreditResponse upsert(Long accountId, CreditRequest request);

    void delete(Long accountId);

    /** Advances every stored cut-off / payment date already in the past (idempotent). Returns how many changed. */
    int refreshDates();
}
