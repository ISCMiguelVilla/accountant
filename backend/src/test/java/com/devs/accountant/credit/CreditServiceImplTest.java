package com.devs.accountant.credit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devs.accountant.account.Account;
import com.devs.accountant.account.AccountRepository;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.credit.dto.CreditRequest;
import com.devs.accountant.credit.dto.CreditResponse;
import com.devs.accountant.schedule.CronService;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CreditServiceImplTest {

    private static final ZoneId MX = ZoneId.of("America/Mexico_City");
    /** "Today" for every test: Saturday 2026-10-10. */
    private static final Clock CLOCK =
            Clock.fixed(LocalDate.of(2026, 10, 10).atTime(9, 30).atZone(MX).toInstant(), MX);

    @Mock
    private CreditRepository creditRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CurrentUser currentUser;

    private CreditServiceImpl service;

    @BeforeEach
    void setUp() {
        service =
                new CreditServiceImpl(creditRepository, accountRepository, new CronService(CLOCK), currentUser, CLOCK);
        when(currentUser.id()).thenReturn(1L);
        when(creditRepository.findByAccountId(any())).thenReturn(Optional.empty());
    }

    @Test
    void computesTheNextCutOffAndPaymentDates() {
        debtor(5L, "7500");

        CreditResponse response =
                service.upsert(5L, new CreditRequest(new BigDecimal("30000"), "0 0 0 15 * *", "0 0 0 5 * *"));

        assertThat(response.cutOffDay()).isEqualTo(LocalDate.of(2026, 10, 15));
        assertThat(response.paymentDueDay()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(response.availableCredit()).isEqualByComparingTo("22500.00");
        assertThat(response.usagePercentage()).isEqualByComparingTo("25.00");
        verify(creditRepository).save(any(Credit.class));
    }

    @Test
    void todayCountsAndLastDayOfMonthIsSupported() {
        debtor(5L, "0");

        CreditResponse response =
                service.upsert(5L, new CreditRequest(new BigDecimal("1000"), "0 0 0 10 * *", "0 0 0 L * *"));

        assertThat(response.cutOffDay()).isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(response.paymentDueDay()).isEqualTo(LocalDate.of(2026, 10, 31));
    }

    @Test
    void onlyDebtorAccountsCanHaveCredit() {
        Account storage = debtor(5L, "0");
        storage.setType(AccountType.STORAGE);

        assertThatThrownBy(() -> service.upsert(5L, new CreditRequest(BigDecimal.TEN, "0 0 0 15 * *", "0 0 0 5 * *")))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        ex -> assertThat(((BusinessException) ex).getErrors()).containsKey("type"));
        verify(creditRepository, never()).save(any());
    }

    @Test
    void invalidCronIsRejected() {
        debtor(5L, "0");

        assertThatThrownBy(() -> service.upsert(5L, new CreditRequest(BigDecimal.TEN, "every 15th", "0 0 0 5 * *")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo(ErrorCode.INVALID_CRON);
                    assertThat(business.getErrors()).containsEntry("cutOffCron", CronService.INVALID_CRON);
                });
    }

    @Test
    void refreshAdvancesOnlyPastDatesAndIsIdempotent() {
        Credit credit = new Credit();
        credit.setCutOffCron("0 0 0 15 * *");
        credit.setPaymentDueCron("0 0 0 5 * *");
        credit.setCutOffDay(LocalDate.of(2026, 9, 15));
        credit.setPaymentDueDay(LocalDate.of(2026, 11, 5));
        when(creditRepository.findStale(LocalDate.of(2026, 10, 10))).thenReturn(List.of(credit));

        assertThat(service.refreshDates()).isEqualTo(1);
        assertThat(credit.getCutOffDay()).isEqualTo(LocalDate.of(2026, 10, 15));
        assertThat(credit.getPaymentDueDay()).isEqualTo(LocalDate.of(2026, 11, 5));

        service.refreshDates();
        assertThat(credit.getCutOffDay()).isEqualTo(LocalDate.of(2026, 10, 15));
    }

    private Account debtor(Long id, String balance) {
        Account account = new Account();
        account.setId(id);
        account.setUserId(1L);
        account.setType(AccountType.DEBTOR);
        account.setBalance(new BigDecimal(balance));
        when(accountRepository.findByIdAndUserId(id, 1L)).thenReturn(Optional.of(account));
        return account;
    }
}
