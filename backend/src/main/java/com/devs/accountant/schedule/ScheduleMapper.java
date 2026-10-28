package com.devs.accountant.schedule;

import com.devs.accountant.account.AccountMapper;
import com.devs.accountant.currency.CurrencyMapper;
import com.devs.accountant.schedule.dto.ScheduleResponse;
import com.devs.accountant.transaction.engine.TransactionRules;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(
        uses = {AccountMapper.class, CurrencyMapper.class},
        imports = TransactionRules.class)
public interface ScheduleMapper {

    @Mapping(target = "currency", source = "origin.currency")
    @Mapping(
            target = "operationType",
            expression =
                    "java(TransactionRules.operationType(schedule.getType(), schedule.getDestination() == null ? null : schedule.getDestination().getType()))")
    ScheduleResponse toResponse(Schedule schedule);
}
