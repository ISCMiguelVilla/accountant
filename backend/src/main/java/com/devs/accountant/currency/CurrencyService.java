package com.devs.accountant.currency;

import com.devs.accountant.currency.dto.CurrencyFilter;
import com.devs.accountant.currency.dto.CurrencyOption;
import com.devs.accountant.currency.dto.CurrencyRequest;
import com.devs.accountant.currency.dto.CurrencyResponse;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import java.util.List;

public interface CurrencyService {

    /** Active currencies, for selects. */
    List<CurrencyOption> options();

    PageResponse<CurrencyResponse> findAll(CurrencyFilter filter, PageParams params);

    CurrencyResponse findById(Long id);

    CurrencyResponse create(CurrencyRequest request);

    CurrencyResponse update(Long id, CurrencyRequest request);
}
