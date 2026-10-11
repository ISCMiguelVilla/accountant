package com.devs.accountant.transaction;

import com.devs.accountant.account.AccountMapper;
import com.devs.accountant.currency.CurrencyMapper;
import com.devs.accountant.transaction.dto.TransactionResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(uses = {AccountMapper.class, CurrencyMapper.class})
public interface TransactionMapper {

    @Mapping(target = "currency", source = "origin.currency")
    TransactionResponse toResponse(Transaction transaction);
}
