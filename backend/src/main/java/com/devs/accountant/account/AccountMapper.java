package com.devs.accountant.account;

import com.devs.accountant.account.dto.AccountOption;
import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.account.dto.AccountResponse;
import com.devs.accountant.credit.dto.CreditResponse;
import com.devs.accountant.currency.CurrencyMapper;
import java.time.LocalDateTime;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(uses = CurrencyMapper.class)
public interface AccountMapper {

    @Mapping(target = "credit", source = "credit")
    AccountResponse toResponse(Account account, CreditResponse credit);

    @Mapping(target = "parentId", source = "account.parent.id")
    @Mapping(target = "credit", source = "credit")
    @Mapping(target = "lastOperationDate", source = "lastOperationDate")
    AccountOption toOption(Account account, CreditResponse credit, LocalDateTime lastOperationDate);

    AccountRef toRef(Account account);
}
