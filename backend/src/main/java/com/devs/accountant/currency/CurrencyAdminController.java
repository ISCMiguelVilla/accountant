package com.devs.accountant.currency;

import com.devs.accountant.currency.dto.CurrencyFilter;
import com.devs.accountant.currency.dto.CurrencyRequest;
import com.devs.accountant.currency.dto.CurrencyResponse;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Currency catalog administration; disabling a currency replaces deleting it. */
@RestController
@RequestMapping("/admin/currencies")
@RequiredArgsConstructor
public class CurrencyAdminController {

    private final CurrencyService currencyService;

    @GetMapping
    public PageResponse<CurrencyResponse> findAll(@ModelAttribute CurrencyFilter filter, PageParams params) {
        return currencyService.findAll(filter, params);
    }

    @GetMapping("/{id}")
    public CurrencyResponse findById(@PathVariable Long id) {
        return currencyService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CurrencyResponse create(@Valid @RequestBody CurrencyRequest request) {
        return currencyService.create(request);
    }

    @PutMapping("/{id}")
    public CurrencyResponse update(@PathVariable Long id, @Valid @RequestBody CurrencyRequest request) {
        return currencyService.update(id, request);
    }
}
