package com.devs.accountant.credit;

import com.devs.accountant.account.Account;
import com.devs.accountant.account.AccountRepository;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.credit.dto.CreditRequest;
import com.devs.accountant.credit.dto.CreditResponse;
import com.devs.accountant.schedule.CronService;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.security.CurrentUser;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreditServiceImpl implements CreditService {

    static final String NOT_DEBTOR = "CREDIT_REQUIRES_DEBTOR";

    private final CreditRepository creditRepository;
    private final AccountRepository accountRepository;
    private final CronService cronService;
    private final CurrentUser currentUser;
    private final Clock clock;

    @Override
    @Transactional
    public CreditResponse upsert(Long accountId, CreditRequest request) {
        Account account = loadAccount(accountId);
        if (account.getType() != AccountType.DEBTOR) {
            throw BusinessException.fieldError("type", NOT_DEBTOR);
        }
        CronExpression cutOff = cronService.parse(request.cutOffCron(), "cutOffCron");
        CronExpression paymentDue = cronService.parse(request.paymentDueCron(), "paymentDueCron");
        LocalDate today = LocalDate.now(clock);

        Credit credit = creditRepository.findByAccountId(accountId).orElseGet(() -> {
            Credit created = new Credit();
            created.setAccount(account);
            return created;
        });
        credit.setCreditLimit(request.creditLimit().setScale(2, RoundingMode.HALF_UP));
        credit.setCutOffCron(request.cutOffCron().trim());
        credit.setPaymentDueCron(request.paymentDueCron().trim());
        credit.setCutOffDay(cronService.nextOnOrAfter(cutOff, today, "cutOffCron"));
        credit.setPaymentDueDay(cronService.nextOnOrAfter(paymentDue, today, "paymentDueCron"));
        creditRepository.save(credit);
        return CreditResponse.of(credit, account.getBalance());
    }

    @Override
    @Transactional
    public void delete(Long accountId) {
        loadAccount(accountId);
        creditRepository.findByAccountId(accountId).ifPresent(creditRepository::delete);
    }

    @Override
    @Transactional
    public int refreshDates() {
        LocalDate today = LocalDate.now(clock);
        int updated = 0;
        for (Credit credit : creditRepository.findStale(today)) {
            try {
                if (credit.getCutOffDay().isBefore(today)) {
                    credit.setCutOffDay(cronService.nextOnOrAfter(
                            cronService.parse(credit.getCutOffCron(), "cutOffCron"), today, "cutOffCron"));
                }
                if (credit.getPaymentDueDay().isBefore(today)) {
                    credit.setPaymentDueDay(cronService.nextOnOrAfter(
                            cronService.parse(credit.getPaymentDueCron(), "paymentDueCron"), today, "paymentDueCron"));
                }
                updated++;
            } catch (BusinessException ex) {
                log.warn("Credit {} has an invalid cron and was not advanced", credit.getId());
            }
        }
        if (updated > 0) {
            log.info("Advanced the dates of {} credit(s)", updated);
        }
        return updated;
    }

    private Account loadAccount(Long accountId) {
        return accountRepository
                .findByIdAndUserId(accountId, currentUser.id())
                .filter(account -> !account.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Account", accountId));
    }
}
