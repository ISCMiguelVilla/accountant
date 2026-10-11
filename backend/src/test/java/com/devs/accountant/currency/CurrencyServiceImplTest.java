package com.devs.accountant.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devs.accountant.currency.dto.CurrencyRequest;
import com.devs.accountant.shared.exception.BusinessException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CurrencyServiceImplTest {

    @Mock
    private CurrencyRepository currencyRepository;

    private CurrencyServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CurrencyServiceImpl(currencyRepository, new CurrencyMapperImpl());
    }

    @Test
    void createNormalizesIsoAndTrimsValues() {
        when(currencyRepository.save(any(Currency.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(new CurrencyRequest(" Euro ", "eur", " € ", CurrencyStatus.ACTIVE));

        assertThat(response.name()).isEqualTo("Euro");
        assertThat(response.iso()).isEqualTo("EUR");
        assertThat(response.symbol()).isEqualTo("€");
    }

    @Test
    void duplicatedIsoIsAFieldError() {
        when(currencyRepository.existsByNameIgnoreCaseAndIdNot(anyString(), anyLong()))
                .thenReturn(false);
        when(currencyRepository.existsByIsoIgnoreCaseAndIdNot("USD", -1L)).thenReturn(true);

        assertThatThrownBy(() -> service.create(new CurrencyRequest("Dólar", "usd", "$", CurrencyStatus.ACTIVE)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrors())
                        .containsEntry("iso", CurrencyServiceImpl.DUPLICATED));
        verify(currencyRepository, never()).save(any());
    }

    @Test
    void updateIgnoresItsOwnNameAndIso() {
        Currency mxn = new Currency();
        mxn.setId(1L);
        when(currencyRepository.findById(1L)).thenReturn(Optional.of(mxn));
        when(currencyRepository.existsByNameIgnoreCaseAndIdNot("Peso", 1L)).thenReturn(false);
        when(currencyRepository.existsByIsoIgnoreCaseAndIdNot("MXN", 1L)).thenReturn(false);

        var response = service.update(1L, new CurrencyRequest("Peso", "MXN", "$", CurrencyStatus.DISABLED));

        assertThat(response.status()).isEqualTo(CurrencyStatus.DISABLED);
    }

    @Test
    void optionsOnlyListActiveCurrencies() {
        Currency mxn = new Currency();
        mxn.setId(1L);
        mxn.setIso("MXN");
        when(currencyRepository.findByStatusOrderByName(CurrencyStatus.ACTIVE)).thenReturn(List.of(mxn));

        assertThat(service.options()).extracting("iso").containsExactly("MXN");
    }
}
