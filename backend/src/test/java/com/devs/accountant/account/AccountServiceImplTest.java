package com.devs.accountant.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devs.accountant.account.dto.AccountRequest;
import com.devs.accountant.account.dto.AccountUpdateRequest;
import com.devs.accountant.credit.Credit;
import com.devs.accountant.credit.CreditRepository;
import com.devs.accountant.currency.Currency;
import com.devs.accountant.currency.CurrencyRepository;
import com.devs.accountant.currency.CurrencyStatus;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;
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
class AccountServiceImplTest {

    private static final long USER = 7L;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CreditRepository creditRepository;

    @Mock
    private CurrencyRepository currencyRepository;

    @Mock
    private AccountMapper accountMapper;

    @Mock
    private CurrentUser currentUser;

    private AccountServiceImpl service;
    private Currency mxn;

    @BeforeEach
    void setUp() {
        service = new AccountServiceImpl(
                accountRepository, creditRepository, currencyRepository, accountMapper, currentUser);
        when(currentUser.id()).thenReturn(USER);
        mxn = currency(1L, CurrencyStatus.ACTIVE);
        when(currencyRepository.findById(1L)).thenReturn(Optional.of(mxn));
        when(accountRepository.findSubtreeIds(anyLong())).thenAnswer(inv -> Set.of((Long) inv.getArgument(0)));
        when(accountRepository.findChildTypes(anyLong(), any())).thenReturn(Set.of());
        when(creditRepository.findByAccountId(anyLong())).thenReturn(Optional.empty());
        when(accountRepository.saveAndFlush(any(Account.class))).thenAnswer(inv -> {
            Account account = inv.getArgument(0);
            if (account.getId() == null) {
                account.setId(100L);
            }
            return account;
        });
    }

    // ------------------------------------------------------------ create

    @Test
    void typesWithoutBalanceStoreNullAndTypesWithBalanceDefaultToZero() {
        Account consumer = created(request("Comida", AccountType.CONSUMER, null, new BigDecimal("50")));
        Account storage = created(request("Banco", AccountType.STORAGE, null, null));

        assertThat(consumer.getBalance()).isNull();
        assertThat(storage.getBalance()).isEqualByComparingTo("0.00");
    }

    @Test
    void duplicatedNamePerTypeIsRejected() {
        when(accountRepository.existsByUserIdAndNameIgnoreCaseAndTypeAndStatusNotAndIdNot(
                        eq(USER), eq("Banco"), eq(AccountType.STORAGE), eq(AccountStatus.DELETED), anyLong()))
                .thenReturn(true);

        assertFieldError(
                () -> service.create(request(" Banco ", AccountType.STORAGE, null, null)),
                "name",
                AccountServiceImpl.DUPLICATED);
    }

    @Test
    void parentMustAcceptTheChildType() {
        Account consumerParent = account(2L, AccountType.CONSUMER, null);
        when(accountRepository.findByIdAndUserId(2L, USER)).thenReturn(Optional.of(consumerParent));

        assertFieldError(
                () -> service.create(request("Banco", AccountType.STORAGE, 2L, null)),
                "parentId",
                AccountServiceImpl.INVALID_PARENT);
    }

    @Test
    void deletedParentIsRejected() {
        Account group = account(2L, AccountType.GROUP, null);
        group.setStatus(AccountStatus.DELETED);
        when(accountRepository.findByIdAndUserId(2L, USER)).thenReturn(Optional.of(group));

        assertFieldError(
                () -> service.create(request("Banco", AccountType.STORAGE, 2L, null)),
                "parentId",
                AccountServiceImpl.INVALID_PARENT);
    }

    @Test
    void temporaryIsOnlyForInvestmentAndBusiness() {
        AccountRequest storage =
                new AccountRequest("Banco", AccountType.STORAGE, null, 1L, null, null, null, true, true, null, null);

        assertFieldError(() -> service.create(storage), "temporary", AccountServiceImpl.TEMPORARY_NOT_ALLOWED);
    }

    @Test
    void disabledCurrencyCannotBeAssigned() {
        when(currencyRepository.findById(9L)).thenReturn(Optional.of(currency(9L, CurrencyStatus.DISABLED)));
        AccountRequest request =
                new AccountRequest("Banco", AccountType.STORAGE, null, 9L, null, null, null, null, null, null, null);

        assertFieldError(() -> service.create(request), "currencyId", AccountServiceImpl.CURRENCY_NOT_AVAILABLE);
    }

    // ------------------------------------------------------------ update

    @Test
    void parentCannotBeADescendantOfTheAccount() {
        Account root = existing(1L, AccountType.STORAGE, "100");
        Account grandChild = account(3L, AccountType.STORAGE, BigDecimal.ZERO);
        when(accountRepository.findByIdAndUserId(3L, USER)).thenReturn(Optional.of(grandChild));
        when(accountRepository.findSubtreeIds(1L)).thenReturn(Set.of(1L, 2L, 3L));

        assertFieldError(
                () -> service.update(1L, full(request("Banco", AccountType.STORAGE, 3L, null))),
                "parentId",
                AccountServiceImpl.PARENT_CYCLE);
        assertThat(root.getParent()).isNull();
    }

    @Test
    void manualBalanceEditOverwritesTheBalance() {
        Account debtor = existing(1L, AccountType.DEBTOR, "5000");

        service.update(1L, full(request("Visa", AccountType.DEBTOR, null, new BigDecimal("2500"))));

        assertThat(debtor.getBalance()).isEqualByComparingTo("2500.00");
    }

    @Test
    void staleVersionIsAConflict() {
        existing(1L, AccountType.STORAGE, "100");
        AccountUpdateRequest stale = new AccountUpdateRequest();
        stale.setVersion(3L);

        assertThatThrownBy(() -> service.update(1L, stale))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    void onlyThePropertiesSentAreUpdatedAndTheIdNeverChanges() {
        Account account = existing(1L, AccountType.STORAGE, "100");
        Account parent = account(2L, AccountType.GROUP, null);
        account.setParent(parent);
        account.setIcon("pi pi-wallet");
        account.setColor("#2563EB");
        account.setIncludeInBalance(false);
        when(accountRepository.findByIdAndUserId(2L, USER)).thenReturn(Optional.of(parent));
        AccountUpdateRequest update = new AccountUpdateRequest();
        update.setName("Banco principal");

        service.update(1L, update);

        assertThat(account.getId()).isEqualTo(1L);
        assertThat(account.getName()).isEqualTo("Banco principal");
        assertThat(account.getType()).isEqualTo(AccountType.STORAGE);
        assertThat(account.getParent()).isSameAs(parent);
        assertThat(account.getBalance()).isEqualByComparingTo("100.00");
        assertThat(account.getIcon()).isEqualTo("pi pi-wallet");
        assertThat(account.getColor()).isEqualTo("#2563EB");
        assertThat(account.isIncludeInBalance()).isFalse();
        assertThat(account.getCurrency()).isSameAs(mxn);
    }

    @Test
    void explicitNullClearsParentIconAndColor() {
        Account account = existing(1L, AccountType.STORAGE, "100");
        Account parent = account(2L, AccountType.GROUP, null);
        account.setParent(parent);
        account.setIcon("pi pi-wallet");
        account.setColor("#2563EB");
        AccountUpdateRequest update = new AccountUpdateRequest();
        update.setParentId(null);
        update.setIcon(null);
        update.setColor(null);

        service.update(1L, update);

        assertThat(account.getParent()).isNull();
        assertThat(account.getIcon()).isNull();
        assertThat(account.getColor()).isNull();
        assertThat(account.getName()).isEqualTo("Account 1");
    }

    @Test
    void requiredPropertiesCannotBeSentAsNull() {
        existing(1L, AccountType.STORAGE, "100");
        AccountUpdateRequest update = new AccountUpdateRequest();
        update.setType(null);

        assertFieldError(() -> service.update(1L, update), "type", "NotNull");
    }

    @Test
    void typeChangesFreelyWithoutChildrenOrTransactions() {
        Account account = existing(1L, AccountType.CREDITOR, "0");

        service.update(1L, type(AccountType.SUPPLIER));

        assertThat(account.getType()).isEqualTo(AccountType.SUPPLIER);
        assertThat(account.getBalance()).isNull();
    }

    @Test
    void changingToATypeWithoutBalanceRequiresZeroBalance() {
        existing(1L, AccountType.STORAGE, "100");

        assertFieldError(
                () -> service.update(1L, type(AccountType.CONSUMER)),
                "type",
                AccountServiceImpl.TYPE_CHANGE_REQUIRES_ZERO_BALANCE);
    }

    @Test
    void typeCannotChangeOnceTheAccountHasTransactions() {
        Account account = existing(1L, AccountType.STORAGE, "100");
        when(accountRepository.hasTransactions(1L)).thenReturn(true);

        assertFieldError(
                () -> service.update(1L, type(AccountType.INVESTMENT)),
                "type",
                AccountServiceImpl.TYPE_CHANGE_NOT_ALLOWED);
        assertThat(account.getType()).isEqualTo(AccountType.STORAGE);
        // the rest of the account can still be edited
        AccountUpdateRequest rename = new AccountUpdateRequest();
        rename.setName("Banco principal");
        service.update(1L, rename);
        assertThat(account.getName()).isEqualTo("Banco principal");
    }

    @Test
    void newTypeMustStillAcceptEverySubAccount() {
        existing(1L, AccountType.STORAGE, "100");
        when(accountRepository.findChildTypes(1L, AccountStatus.DELETED)).thenReturn(Set.of(AccountType.DEBTOR));

        assertFieldError(
                () -> service.update(1L, type(AccountType.INVESTMENT)),
                "type",
                AccountServiceImpl.TYPE_CHANGE_NOT_ALLOWED);
    }

    @Test
    void accountWithCreditMustStayDebtor() {
        existing(1L, AccountType.DEBTOR, "0");
        when(creditRepository.existsByAccountId(1L)).thenReturn(true);

        assertFieldError(
                () -> service.update(1L, type(AccountType.STORAGE)), "type", AccountServiceImpl.CREDIT_REQUIRES_DEBTOR);
    }

    // ------------------------------------------------------------ delete

    @Test
    void cannotDeleteWithBalanceOrLiveSubAccounts() {
        existing(1L, AccountType.STORAGE, "0.01");
        existing(2L, AccountType.GROUP, null);
        when(accountRepository.existsByParentIdAndStatusNot(2L, AccountStatus.DELETED))
                .thenReturn(true);

        assertNotDeletable(1L, "BALANCE");
        assertNotDeletable(2L, "CHILDREN");
    }

    @Test
    void deleteIsLogicalAndDropsTheCreditLine() {
        Account debtor = existing(1L, AccountType.DEBTOR, "0");
        Credit credit = new Credit();
        when(creditRepository.findByAccountId(1L)).thenReturn(Optional.of(credit));

        service.delete(1L);

        assertThat(debtor.getStatus()).isEqualTo(AccountStatus.DELETED);
        verify(creditRepository).delete(credit);
    }

    // ------------------------------------------------------------ helpers

    private Account created(AccountRequest request) {
        service.create(request);
        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository, org.mockito.Mockito.atLeastOnce()).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    private Account existing(Long id, AccountType type, String balance) {
        Account account = account(id, type, balance == null ? null : new BigDecimal(balance));
        when(accountRepository.findByIdAndUserId(id, USER)).thenReturn(Optional.of(account));
        return account;
    }

    private Account account(Long id, AccountType type, BigDecimal balance) {
        Account account = new Account();
        account.setId(id);
        account.setUserId(USER);
        account.setType(type);
        account.setName("Account " + id);
        account.setBalance(balance);
        account.setCurrency(mxn);
        account.setVersion(0L);
        return account;
    }

    private static Currency currency(Long id, CurrencyStatus status) {
        Currency currency = new Currency();
        currency.setId(id);
        currency.setIso("MXN");
        currency.setStatus(status);
        return currency;
    }

    /** Update carrying every property, like the account form sends it. */
    private static AccountUpdateRequest full(AccountRequest request) {
        AccountUpdateRequest update = new AccountUpdateRequest();
        update.setName(request.name());
        update.setType(request.type());
        update.setParentId(request.parentId());
        update.setCurrencyId(request.currencyId());
        update.setBalance(request.balance());
        update.setIcon(request.icon());
        update.setColor(request.color());
        update.setIncludeInBalance(request.includeInBalance());
        update.setTemporary(request.temporary());
        update.setStatus(request.status());
        update.setVersion(request.version());
        return update;
    }

    private static AccountUpdateRequest type(AccountType type) {
        AccountUpdateRequest update = new AccountUpdateRequest();
        update.setType(type);
        return update;
    }

    private static AccountRequest request(String name, AccountType type, Long parentId, BigDecimal balance) {
        return new AccountRequest(name, type, parentId, 1L, balance, null, null, null, null, null, null);
    }

    private void assertNotDeletable(Long id, String reason) {
        assertThatThrownBy(() -> service.delete(id))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo(ErrorCode.ACCOUNT_NOT_DELETABLE);
                    assertThat(business.getParams()).containsEntry("reason", reason);
                });
    }

    private static void assertFieldError(
            org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String field, String code) {
        assertThatThrownBy(call)
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        ex -> assertThat(((BusinessException) ex).getErrors()).containsEntry(field, code));
    }
}
