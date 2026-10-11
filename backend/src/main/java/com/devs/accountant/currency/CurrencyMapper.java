package com.devs.accountant.currency;

import com.devs.accountant.currency.dto.CurrencyOption;
import com.devs.accountant.currency.dto.CurrencyResponse;
import org.mapstruct.Mapper;

@Mapper
public interface CurrencyMapper {

    CurrencyResponse toResponse(Currency currency);

    CurrencyOption toOption(Currency currency);
}
