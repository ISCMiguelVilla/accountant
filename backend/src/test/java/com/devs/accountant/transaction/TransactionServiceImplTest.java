package com.devs.accountant.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devs.accountant.account.Account;
import com.devs.accountant.account.AccountRepository;
import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.credit.Credit;
import com.devs.accountant.credit.CreditRepository;
import com.devs.accountant.schedule.CronService;
import com.devs.accountant.schedule.Schedule;
import com.devs.accountant.schedule.ScheduleRepository;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.security.CurrentUser;
import com.devs.accountant.transaction.dto.BatchRequest;
import com.devs.accountant.transaction.dto.TransactionRequest;
import com.devs.accountant.transaction.dto.TransactionRulesResponse;
import com.devs.accountant.transaction.engine.DestinationMode;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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
class TransactionServiceImplTest {

    private static final long USER = 1L;
    private static final ZoneId MX = ZoneId.of("America/Mexico_City");
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 10, 9, 0);

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CreditRepository creditRepository;

    @Mock
    private ScheduleRepository scheduleRepository;

    @Mock
    private TransactionMapper transactionMapper;

    @Mock
    private CurrentUser currentUser;

    private TransactionServiceImpl service;
    private final List<Account> accounts = new ArrayList<>();

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW.atZone(MX).toInstant(), MX);
        service = new TransactionServiceImpl(
                transactionRepository,
                accountRepository,
                creditRepository,
                scheduleRepository,
                transactionMapper,
                new CronService(clock),
                currentUser,
                clock);
        when(currentUser.id()).thenReturn(USER);
        when(transactionRepository.findExistingUuids(anyCollection())).thenReturn(List.of());
        when(accountRepository.findLastOperationDatesOf(anyCollection())).thenReturn(List.of());
        when(creditRepository.findByAccountIdIn(anyCollection())).thenReturn(List.of());
        when(accountRepository.lockForUpdate(any(), anyCollection())).thenAnswer(invocation -> {
            var ids = invocation.<java.util.Collection<Long>>getArgument(1);
            return accounts.stream().filter(a -> ids.contains(a.getId())).toList();
        });
    }

    // -------------------------------------------------------------- batch

    @Test
    void savesTheBatchWithSnapshotsAndUpdatesTheAccounts() {
        Account bank = account(1L, AccountType.STORAGE, "1000.00");
        Account food = account(2L, AccountType.CONSUMER, null);
        Account visa = account(3L, AccountType.DEBTOR, "500.00");
        visa.setPendingExpense(new BigDecimal("500.00"));
        credit(visa, "1000.00");

        var response = service.saveBatch(batch(
                tx("EXPENSE", 1L, 2L, "200.00", NOW.minusDays(2)), tx("PAYMENT", 1L, 3L, "300.00", NOW.minusDays(1))));

        List<Transaction> saved = savedTransactions();
        assertThat(saved).hasSize(2);
        Transaction expense = saved.get(0);
        assertThat(expense.getOperationType()).isEqualTo(OperationType.SUBTRACTION);
        assertThat(expense.getOriginBalanceBefore()).isEqualByComparingTo("1000.00");
        assertThat(expense.getOriginBalanceAfter()).isEqualByComparingTo("800.00");
        assertThat(expense.getAppliedAt()).isEqualTo(expense.getOperationDate());
        Transaction payment = saved.get(1);
        assertThat(payment.getReportedAmount()).isEqualByComparingTo("300.00");
        assertThat(payment.getDestinationBalanceAfter()).isEqualByComparingTo("200.00");
        assertThat(saved).extracting(Transaction::getBatchUuid).containsOnly(response.batchUuid());

        assertThat(bank.getBalance()).isEqualByComparingTo("500.00");
        assertThat(visa.getBalance()).isEqualByComparingTo("200.00");
        assertThat(visa.getPendingExpense()).isEqualByComparingTo("200.00");
        assertThat(food.getBalance()).isNull();
    }

    @Test
    void anyFailureRejectsTheWholeBatchWithTheFailingTransaction() {
        Account bank = account(1L, AccountType.STORAGE, "100.00");
        account(2L, AccountType.CONSUMER, null);
        TransactionRequest ok = tx("EXPENSE", 1L, 2L, "50.00", NOW.minusDays(2));
        TransactionRequest fails = tx("EXPENSE", 1L, 2L, "60.00", NOW.minusDays(1));

        assertThatThrownBy(() -> service.saveBatch(batch(ok, fails)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo(ErrorCode.INSUFFICIENT_FUNDS);
                    assertThat(business.getTransactionUuid())
                            .isEqualTo(fails.uuid().toString());
                    assertThat(business.getParams()).containsEntry("index", 1);
                });
        verify(transactionRepository, never()).saveAll(anyList());
        assertThat(bank.getBalance()).isEqualByComparingTo("100.00");
    }

    @Test
    void validationErrorsOfTheEngineKeepTheField() {
        account(1L, AccountType.STORAGE, "100.00");

        assertThatThrownBy(() -> service.saveBatch(batch(tx("TRANSFER", 1L, null, "10.00", NOW))))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(business.getErrors()).containsEntry("destinationAccountId", "DESTINATION_REQUIRED");
                });
    }

    @Test
    void operationDateCannotBeBeforeTheLastPersistedTransaction() {
        account(1L, AccountType.STORAGE, "100.00");
        account(2L, AccountType.CONSUMER, null);
        AccountRepository.LastOperation last = new AccountRepository.LastOperation() {
            public Long getAccountId() {
                return 1L;
            }

            public LocalDateTime getLastOperationDate() {
                return NOW.minusDays(1);
            }
        };
        when(accountRepository.findLastOperationDatesOf(anyCollection())).thenReturn(List.of(last));

        assertThatThrownBy(() -> service.saveBatch(batch(tx("EXPENSE", 1L, 2L, "10.00", NOW.minusDays(2)))))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.DATE_BEFORE_LAST_TRANSACTION);
        // the same date is allowed
        assertThat(service.saveBatch(batch(tx("EXPENSE", 1L, 2L, "10.00", NOW.minusDays(1)))))
                .isNotNull();
    }

    @Test
    void accountChangedSinceTheDraftIsAConflict() {
        Account bank = account(1L, AccountType.STORAGE, "100.00");
        bank.setVersion(4L);
        account(2L, AccountType.CONSUMER, null);

        assertThatThrownBy(() -> service.saveBatch(
                        new BatchRequest(List.of(tx("EXPENSE", 1L, 2L, "10.00", NOW)), Map.of(1L, 3L))))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    void unknownOrForeignAccountsAreNotFound() {
        account(1L, AccountType.STORAGE, "100.00");

        assertThatThrownBy(() -> service.saveBatch(batch(tx("EXPENSE", 1L, 99L, "10.00", NOW))))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    void duplicatedUuidsAreRejected() {
        account(1L, AccountType.STORAGE, "100.00");
        account(2L, AccountType.CONSUMER, null);
        TransactionRequest first = tx("EXPENSE", 1L, 2L, "10.00", NOW);
        TransactionRequest copy = new TransactionRequest(
                first.uuid(), first.type(), 1L, 2L, BigDecimal.ONE, null, "Copy", true, NOW, null);

        assertThatThrownBy(() -> service.saveBatch(batch(first, copy)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrors())
                        .containsEntry("transactions[1].uuid", TransactionServiceImpl.DUPLICATED));
    }

    @Test
    void temporaryAccountIsDisabledByItsProfit() {
        Account cetes = account(1L, AccountType.INVESTMENT, "500.00");
        cetes.setTemporary(true);
        account(2L, AccountType.STORAGE, "0.00");

        service.saveBatch(batch(tx("PROFIT", 1L, 2L, "500.00", NOW)));

        assertThat(cetes.getStatus()).isEqualTo(AccountStatus.DISABLED);
    }

    @Test
    void executedScheduleAdvancesFromItsPreviousNextExecution() {
        Account bank = account(1L, AccountType.STORAGE, "1000.00");
        Account internet = account(2L, AccountType.CONSUMER, null);
        Schedule schedule = new Schedule();
        schedule.setId(5L);
        schedule.setType(TransactionType.EXPENSE);
        schedule.setOrigin(bank);
        schedule.setDestination(internet);
        schedule.setCronExpression("0 0 0 10 * *");
        schedule.setNextExecution(LocalDateTime.of(2026, 10, 10, 0, 0));
        when(scheduleRepository.findByUserIdAndIdInAndStatusNot(any(), anyCollection(), any()))
                .thenReturn(List.of(schedule));
        TransactionRequest base = tx("EXPENSE", 1L, 2L, "599.00", NOW);
        TransactionRequest scheduled = new TransactionRequest(
                base.uuid(), base.type(), 1L, 2L, base.amount(), null, "Internet", true, NOW, 5L);

        service.saveBatch(batch(scheduled));

        assertThat(schedule.getLastExecution()).isEqualTo(NOW);
        assertThat(schedule.getNextExecution()).isEqualTo(LocalDateTime.of(2026, 11, 10, 0, 0));
    }

    @Test
    void scheduleMustMatchTypeAndAccounts() {
        Account bank = account(1L, AccountType.STORAGE, "1000.00");
        account(2L, AccountType.CONSUMER, null);
        Schedule schedule = new Schedule();
        schedule.setId(5L);
        schedule.setType(TransactionType.INCOME);
        schedule.setOrigin(bank);
        when(scheduleRepository.findByUserIdAndIdInAndStatusNot(any(), anyCollection(), any()))
                .thenReturn(List.of(schedule));
        TransactionRequest base = tx("EXPENSE", 1L, 2L, "10.00", NOW);
        TransactionRequest scheduled = new TransactionRequest(
                base.uuid(), base.type(), 1L, 2L, base.amount(), null, "Internet", true, NOW, 5L);

        assertThatThrownBy(() -> service.saveBatch(batch(scheduled)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrors())
                        .containsEntry("transactions[0].scheduleId", TransactionServiceImpl.SCHEDULE_MISMATCH));
    }

    // -------------------------------------------------------------- apply

    @Test
    void applyingAPendingTransferCreditsTheDestinationAndOverwritesItsSnapshots() {
        Account bank = account(1L, AccountType.STORAGE, "700.00");
        Account savings = account(2L, AccountType.STORAGE, "500.00");
        Transaction pending = pending(10L, TransactionType.TRANSFER, bank, savings, "300.00", "5.00");
        pending.setDestinationBalanceBefore(new BigDecimal("400.00"));
        pending.setDestinationBalanceAfter(new BigDecimal("400.00"));

        service.apply(10L);

        assertThat(savings.getBalance()).isEqualByComparingTo("795.00");
        assertThat(bank.getBalance()).isEqualByComparingTo("700.00");
        assertThat(pending.getDestinationBalanceBefore()).isEqualByComparingTo("500.00");
        assertThat(pending.getDestinationBalanceAfter()).isEqualByComparingTo("795.00");
        assertThat(pending.isApplied()).isTrue();
        assertThat(pending.getAppliedAt()).isEqualTo(NOW);
    }

    @Test
    void applyingAPendingExpenseRevalidatesFunds() {
        Account bank = account(1L, AccountType.STORAGE, "100.00");
        Account food = account(2L, AccountType.CONSUMER, null);
        pending(10L, TransactionType.EXPENSE, bank, food, "150.00", "0.00");

        assertThatThrownBy(() -> service.apply(10L))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.INSUFFICIENT_FUNDS);
        assertThat(bank.getBalance()).isEqualByComparingTo("100.00");
    }

    @Test
    void applyingAPendingCardPurchaseGrowsTheDebtWithinTheLimit() {
        Account visa = account(1L, AccountType.DEBTOR, "100.00");
        visa.setPendingExpense(new BigDecimal("100.00"));
        credit(visa, "1000.00");
        Account food = account(2L, AccountType.CONSUMER, null);
        Transaction pending = pending(10L, TransactionType.EXPENSE, visa, food, "200.00", "0.00");

        service.apply(10L);

        assertThat(visa.getBalance()).isEqualByComparingTo("300.00");
        assertThat(visa.getPendingExpense()).isEqualByComparingTo("300.00");
        assertThat(pending.getOriginBalanceBefore()).isEqualByComparingTo("100.00");
        assertThat(pending.getOriginBalanceAfter()).isEqualByComparingTo("300.00");
    }

    @Test
    void applyIsIdempotent() {
        Account bank = account(1L, AccountType.STORAGE, "700.00");
        Account savings = account(2L, AccountType.STORAGE, "500.00");
        Transaction done = pending(10L, TransactionType.TRANSFER, bank, savings, "300.00", "0.00");
        done.setApplied(true);

        service.apply(10L);

        assertThat(savings.getBalance()).isEqualByComparingTo("500.00");
        verify(accountRepository, never()).lockForUpdate(any(), anyCollection());
    }

    @Test
    void onlyPendableTypesCanBeApplied() {
        Account supplier = account(1L, AccountType.SUPPLIER, null);
        Account bank = account(2L, AccountType.STORAGE, "0.00");
        pending(10L, TransactionType.INCOME, supplier, bank, "10.00", "0.00");

        assertThatThrownBy(() -> service.apply(10L))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.TRANSACTION_NOT_SUPPORTED);
    }

    // -------------------------------------------------------------- rules

    @Test
    void rulesExposeTheMatrixWithVariants() {
        TransactionRulesResponse rules = service.rules();

        var payment = rule(rules, TransactionType.PAYMENT);
        assertThat(payment.origins()).containsExactly(AccountType.STORAGE);
        assertThat(payment.variants())
                .singleElement()
                .satisfies(v -> assertThat(v.operationType()).isNull());

        var dividend = rule(rules, TransactionType.DIVIDEND);
        assertThat(dividend.destinationMode()).isEqualTo(DestinationMode.OPTIONAL);
        assertThat(dividend.variants())
                .anySatisfy(v -> assertThat(v.destination()).isNull());

        var debt = rule(rules, TransactionType.DEBT);
        assertThat(debt.variants())
                .anySatisfy(v -> {
                    assertThat(v.destination()).isEqualTo(AccountType.CONSUMER);
                    assertThat(v.feeEnabled()).isFalse();
                })
                .anySatisfy(v -> {
                    assertThat(v.destination()).isEqualTo(AccountType.STORAGE);
                    assertThat(v.feeMustBeBelowAmount()).isTrue();
                });

        var expense = rule(rules, TransactionType.EXPENSE);
        assertThat(expense.pendingAllowed()).isTrue();
        assertThat(expense.variants()).anySatisfy(v -> {
            assertThat(v.origin()).isEqualTo(AccountType.DEBTOR);
            assertThat(v.operationType()).isEqualTo(OperationType.NEUTER);
        });
    }

    // ------------------------------------------------------------ helpers

    private static TransactionRulesResponse.TypeRule rule(TransactionRulesResponse rules, TransactionType type) {
        return rules.types().stream().filter(r -> r.type() == type).findFirst().orElseThrow();
    }

    private Account account(Long id, AccountType type, String balance) {
        Account account = new Account();
        account.setId(id);
        account.setUserId(USER);
        account.setType(type);
        account.setName("Account " + id);
        account.setBalance(balance == null ? null : new BigDecimal(balance));
        if (type == AccountType.DEBTOR && account.getPendingExpense() == null) {
            account.setPendingExpense(BigDecimal.ZERO);
        }
        account.setVersion(0L);
        accounts.add(account);
        return account;
    }

    private void credit(Account account, String limit) {
        Credit credit = new Credit();
        credit.setAccount(account);
        credit.setCreditLimit(new BigDecimal(limit));
        when(creditRepository.findByAccountIdIn(anyCollection())).thenReturn(List.of(credit));
    }

    private Transaction pending(
            Long id, TransactionType type, Account origin, Account destination, String amount, String fee) {
        Transaction tx = new Transaction();
        tx.setId(id);
        tx.setUuid(UUID.randomUUID());
        tx.setType(type);
        tx.setOrigin(origin);
        tx.setDestination(destination);
        tx.setAmount(new BigDecimal(amount));
        tx.setFee(new BigDecimal(fee));
        tx.setApplied(false);
        tx.setOperationDate(NOW.minusDays(3));
        when(transactionRepository.findByIdAndUserId(id, USER)).thenReturn(Optional.of(tx));
        return tx;
    }

    private static TransactionRequest tx(
            String type, Long origin, Long destination, String amount, LocalDateTime date) {
        return new TransactionRequest(
                UUID.randomUUID(),
                TransactionType.valueOf(type),
                origin,
                destination,
                new BigDecimal(amount),
                null,
                type + " test",
                true,
                date,
                null);
    }

    private static BatchRequest batch(TransactionRequest... transactions) {
        return new BatchRequest(List.of(transactions), null);
    }

    @SuppressWarnings("unchecked")
    private List<Transaction> savedTransactions() {
        ArgumentCaptor<List<Transaction>> captor = ArgumentCaptor.forClass(List.class);
        verify(transactionRepository).saveAll(captor.capture());
        return captor.getValue();
    }
}
