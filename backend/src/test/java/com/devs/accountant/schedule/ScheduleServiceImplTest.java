package com.devs.accountant.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.devs.accountant.account.Account;
import com.devs.accountant.account.AccountRepository;
import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.schedule.dto.ScheduleRequest;
import com.devs.accountant.schedule.dto.ScheduleStatusRequest;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.security.CurrentUser;
import com.devs.accountant.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ScheduleServiceImplTest {

    private static final long USER = 1L;
    private static final ZoneId MX = ZoneId.of("America/Mexico_City");
    /** Tuesday 2026-10-27. */
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);

    private static final String MONTHLY_15 = "0 0 0 15 * *";

    @Mock
    private ScheduleRepository scheduleRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private ScheduleMapper scheduleMapper;

    @Mock
    private CurrentUser currentUser;

    private ScheduleServiceImpl service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW.atZone(MX).toInstant(), MX);
        service = new ScheduleServiceImpl(
                scheduleRepository, accountRepository, scheduleMapper, new CronService(clock), currentUser, clock);
        when(currentUser.id()).thenReturn(USER);
        when(scheduleRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createsWithTheFirstCronOccurrenceFromToday() {
        account(1L, AccountType.STORAGE);
        account(2L, AccountType.CONSUMER);

        service.create(request(TransactionType.EXPENSE, 1L, 2L, "599.00", null, MONTHLY_15));

        Schedule saved = saved();
        assertThat(saved.getUserId()).isEqualTo(USER);
        assertThat(saved.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 11, 15, 0, 0));
        assertThat(saved.getFee()).isEqualByComparingTo("0");
        assertThat(saved.getStatus()).isEqualTo(ScheduleStatus.ACTIVE);
    }

    @Test
    void todayCountsWhenTheCronMatchesIt() {
        account(1L, AccountType.STORAGE);
        account(2L, AccountType.CONSUMER);

        service.create(request(TransactionType.EXPENSE, 1L, 2L, "10.00", null, "0 0 0 27 * *"));

        assertThat(saved().getNextExecution()).isEqualTo(LocalDateTime.of(2026, 10, 27, 0, 0));
    }

    @Test
    void followsTheSameRuleMatrixAsTransactions() {
        account(1L, AccountType.STORAGE);
        account(2L, AccountType.CONSUMER);
        account(3L, AccountType.DEBTOR);

        assertField(
                () -> service.create(request(TransactionType.INCOME, 1L, 2L, "10.00", null, MONTHLY_15)),
                "originAccountId",
                "ORIGIN_NOT_ALLOWED");
        assertField(
                () -> service.create(request(TransactionType.EXPENSE, 1L, null, "10.00", null, MONTHLY_15)),
                "destinationAccountId",
                "DESTINATION_REQUIRED");
        assertField(
                () -> service.create(request(TransactionType.DEBT, 3L, 2L, "10.00", "1.00", MONTHLY_15)),
                "fee",
                "FEE_NOT_ALLOWED");
        assertField(
                () -> service.create(request(TransactionType.INTEREST, 1L, 2L, "10.00", null, MONTHLY_15)),
                "destinationAccountId",
                "DESTINATION_NOT_ALLOWED");
    }

    @Test
    void rejectsInvalidCronsAndForeignAccounts() {
        account(1L, AccountType.STORAGE);
        when(accountRepository.findByIdAndUserId(9L, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request(TransactionType.INTEREST, 1L, null, "10", null, "nope")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode()).isEqualTo(ErrorCode.INVALID_CRON));
        assertField(
                () -> service.create(request(TransactionType.INTEREST, 9L, null, "10.00", null, MONTHLY_15)),
                "originAccountId",
                "ACCOUNT_NOT_FOUND");
    }

    @Test
    void disabledAccountsCannotBeScheduled() {
        account(1L, AccountType.STORAGE).setStatus(AccountStatus.DISABLED);

        assertThatThrownBy(() -> service.create(request(TransactionType.INTEREST, 1L, null, "10", null, MONTHLY_15)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode()).isEqualTo(ErrorCode.ACCOUNT_DISABLED));
    }

    @Test
    void updateRecomputesTheNextExecutionOnlyWhenTheCronChanges() {
        account(1L, AccountType.STORAGE);
        Schedule schedule = stored(5L, MONTHLY_15, LocalDateTime.of(2026, 12, 15, 0, 0));

        service.update(5L, request(TransactionType.INTEREST, 1L, null, "20.00", null, MONTHLY_15));
        assertThat(schedule.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 12, 15, 0, 0));
        assertThat(schedule.getAmount()).isEqualByComparingTo("20.00");

        service.update(5L, request(TransactionType.INTEREST, 1L, null, "20.00", null, "0 0 0 1 * *"));
        assertThat(schedule.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 11, 1, 0, 0));
    }

    @Test
    void theNextExecutionKeepsTheCronTimeSoSkipMovesToAnotherDay() {
        account(1L, AccountType.STORAGE);
        account(2L, AccountType.CONSUMER);

        service.create(request(TransactionType.EXPENSE, 1L, 2L, "599.00", null, "0 0 9 30 * *"));
        Schedule saved = saved();
        assertThat(saved.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 10, 30, 9, 0));

        saved.setId(7L);
        when(scheduleRepository.findByIdAndUserId(7L, USER)).thenReturn(Optional.of(saved));
        service.skip(7L);
        assertThat(saved.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 11, 30, 9, 0));
    }

    @Test
    void anExplicitNextExecutionSnapsToTheFirstCronOccurrenceFromThatDay() {
        account(1L, AccountType.STORAGE);
        account(2L, AccountType.CONSUMER);
        ScheduleRequest request = new ScheduleRequest(
                TransactionType.EXPENSE,
                1L,
                2L,
                new BigDecimal("10.00"),
                null,
                "Gasto",
                MONTHLY_15,
                LocalDateTime.of(2026, 12, 3, 0, 0));

        service.create(request);

        assertThat(saved().getNextExecution()).isEqualTo(LocalDateTime.of(2026, 12, 15, 0, 0));
    }

    @Test
    void skipAdvancesToTheFollowingOccurrence() {
        Schedule schedule = stored(5L, MONTHLY_15, LocalDateTime.of(2026, 11, 15, 0, 0));

        service.skip(5L);

        assertThat(schedule.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 12, 15, 0, 0));
        assertThat(schedule.getLastExecution()).isNull();
    }

    @Test
    void statusChangesAndLogicalDelete() {
        Schedule schedule = stored(5L, MONTHLY_15, LocalDateTime.of(2026, 11, 15, 0, 0));

        service.changeStatus(5L, new ScheduleStatusRequest(ScheduleStatus.DISABLED));
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.DISABLED);
        assertField(
                () -> service.changeStatus(5L, new ScheduleStatusRequest(ScheduleStatus.DELETED)),
                "status",
                "INVALID_STATUS");

        service.delete(5L);
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.DELETED);
        assertThatThrownBy(() -> service.findById(5L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void applicableAreTheActiveOnesDueUntilTheEndOfTomorrow() {
        service.applicable();

        var limit = ArgumentCaptor.forClass(LocalDateTime.class);
        org.mockito.Mockito.verify(scheduleRepository)
                .findByUserIdAndStatusAndNextExecutionBeforeOrderByNextExecutionAscIdAsc(
                        org.mockito.ArgumentMatchers.eq(USER),
                        org.mockito.ArgumentMatchers.eq(ScheduleStatus.ACTIVE),
                        limit.capture());
        assertThat(limit.getValue()).isEqualTo(LocalDateTime.of(2026, 10, 29, 0, 0));
    }

    // ------------------------------------------------------------ helpers

    private Account account(Long id, AccountType type) {
        Account account = new Account();
        account.setId(id);
        account.setUserId(USER);
        account.setType(type);
        account.setName("Account " + id);
        account.setStatus(AccountStatus.ACTIVE);
        account.setBalance(type.hasBalance() ? new BigDecimal("1000.00") : null);
        when(accountRepository.findByIdAndUserId(id, USER)).thenReturn(Optional.of(account));
        return account;
    }

    private Schedule stored(Long id, String cron, LocalDateTime next) {
        Schedule schedule = new Schedule();
        schedule.setId(id);
        schedule.setUserId(USER);
        schedule.setType(TransactionType.INTEREST);
        schedule.setAmount(new BigDecimal("10.00"));
        schedule.setFee(BigDecimal.ZERO);
        schedule.setDescription("Comisión");
        schedule.setCronExpression(cron);
        schedule.setNextExecution(next);
        when(scheduleRepository.findByIdAndUserId(id, USER)).thenReturn(Optional.of(schedule));
        return schedule;
    }

    private Schedule saved() {
        var captor = ArgumentCaptor.forClass(Schedule.class);
        org.mockito.Mockito.verify(scheduleRepository).save(captor.capture());
        return captor.getValue();
    }

    private static ScheduleRequest request(
            TransactionType type, Long origin, Long destination, String amount, String fee, String cron) {
        return new ScheduleRequest(
                type,
                origin,
                destination,
                new BigDecimal(amount),
                fee == null ? null : new BigDecimal(fee),
                type + " programada",
                cron,
                null);
    }

    private static void assertField(Runnable call, String field, String code) {
        assertThatThrownBy(call::run)
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        ex -> assertThat(((BusinessException) ex).getErrors()).containsEntry(field, code));
    }
}
