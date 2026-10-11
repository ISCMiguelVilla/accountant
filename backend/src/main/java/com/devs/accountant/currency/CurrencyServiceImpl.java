package com.devs.accountant.currency;

import com.devs.accountant.currency.dto.CurrencyFilter;
import com.devs.accountant.currency.dto.CurrencyOption;
import com.devs.accountant.currency.dto.CurrencyRequest;
import com.devs.accountant.currency.dto.CurrencyResponse;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.shared.paging.QueryDefinition;
import com.devs.accountant.shared.paging.Specs;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CurrencyServiceImpl implements CurrencyService {

    static final String DUPLICATED = "DUPLICATED";
    /** Id that never exists, used to check uniqueness when creating. */
    private static final long NO_ID = -1L;

    static final QueryDefinition QUERY = QueryDefinition.builder()
            .sortable("name", "iso", "createdAt")
            .filterable("name", "status")
            .defaultSort(Sort.by("name"))
            .build();

    private final CurrencyRepository currencyRepository;
    private final CurrencyMapper currencyMapper;

    @Override
    @Transactional(readOnly = true)
    public List<CurrencyOption> options() {
        return currencyRepository.findByStatusOrderByName(CurrencyStatus.ACTIVE).stream()
                .map(currencyMapper::toOption)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CurrencyResponse> findAll(CurrencyFilter filter, PageParams params) {
        var spec =
                Specs.<Currency>all(Specs.contains(filter.name(), "name", "iso"), Specs.in("status", filter.status()));
        return PageResponse.of(
                currencyRepository.findAll(spec, QUERY.toPageable(params)), currencyMapper::toResponse, QUERY);
    }

    @Override
    @Transactional(readOnly = true)
    public CurrencyResponse findById(Long id) {
        return currencyMapper.toResponse(load(id));
    }

    @Override
    @Transactional
    public CurrencyResponse create(CurrencyRequest request) {
        Currency currency = new Currency();
        apply(currency, request, NO_ID);
        return currencyMapper.toResponse(currencyRepository.save(currency));
    }

    @Override
    @Transactional
    public CurrencyResponse update(Long id, CurrencyRequest request) {
        Currency currency = load(id);
        apply(currency, request, id);
        return currencyMapper.toResponse(currency);
    }

    private void apply(Currency currency, CurrencyRequest request, long id) {
        String name = request.name().trim();
        String iso = request.iso().trim().toUpperCase(Locale.ROOT);
        if (currencyRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw BusinessException.fieldError("name", DUPLICATED);
        }
        if (currencyRepository.existsByIsoIgnoreCaseAndIdNot(iso, id)) {
            throw BusinessException.fieldError("iso", DUPLICATED);
        }
        currency.setName(name);
        currency.setIso(iso);
        currency.setSymbol(request.symbol().trim());
        currency.setStatus(request.status());
    }

    private Currency load(Long id) {
        return currencyRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Currency", id));
    }
}
