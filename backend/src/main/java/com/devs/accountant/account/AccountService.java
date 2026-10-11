package com.devs.accountant.account;

import com.devs.accountant.account.dto.AccountDetailResponse;
import com.devs.accountant.account.dto.AccountFilter;
import com.devs.accountant.account.dto.AccountOption;
import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.account.dto.AccountRequest;
import com.devs.accountant.account.dto.AccountResponse;
import com.devs.accountant.account.dto.AccountUpdateRequest;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import java.util.List;

public interface AccountService {

    PageResponse<AccountResponse> findAll(AccountFilter filter, PageParams params);

    /** Usable accounts (ACTIVE, not GROUP) with what the transaction engine needs. */
    List<AccountOption> options();

    /** Accounts "in use" for the home cards: ACTIVE, included in balance, balance > 0, with balance type. */
    List<AccountResponse> inUse();

    /** Valid parents for an account of {@code type}, excluding the subtree of {@code accountId} (no cycles). */
    List<AccountRef> parentOptions(AccountType type, Long accountId);

    AccountDetailResponse findById(Long id);

    AccountDetailResponse create(AccountRequest request);

    /** Partial update: only the properties present in the request change; the id never changes. */
    AccountDetailResponse update(Long id, AccountUpdateRequest request);

    /** Logical delete; only with zero balance and no live sub-accounts. */
    void delete(Long id);
}
