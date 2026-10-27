package com.devs.accountant.account;

import com.devs.accountant.account.dto.AccountDetailResponse;
import com.devs.accountant.account.dto.AccountFilter;
import com.devs.accountant.account.dto.AccountOption;
import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.account.dto.AccountRequest;
import com.devs.accountant.account.dto.AccountResponse;
import com.devs.accountant.account.dto.AccountUpdateRequest;
import com.devs.accountant.credit.Credit;
import com.devs.accountant.credit.CreditRepository;
import com.devs.accountant.credit.dto.CreditResponse;
import com.devs.accountant.currency.Currency;
import com.devs.accountant.currency.CurrencyRepository;
import com.devs.accountant.currency.CurrencyStatus;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.shared.paging.QueryDefinition;
import com.devs.accountant.shared.paging.Specs;
import com.devs.accountant.shared.security.CurrentUser;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountServiceImpl implements AccountService {

    static final String DUPLICATED = "DUPLICATED";
    static final String INVALID_PARENT = "INVALID_PARENT";
    static final String PARENT_CYCLE = "PARENT_CYCLE";
    static final String TYPE_CHANGE_NOT_ALLOWED = "TYPE_CHANGE_NOT_ALLOWED";
    static final String TYPE_CHANGE_REQUIRES_ZERO_BALANCE = "TYPE_CHANGE_REQUIRES_ZERO_BALANCE";
    static final String CREDIT_REQUIRES_DEBTOR = "CREDIT_REQUIRES_DEBTOR";
    static final String TEMPORARY_NOT_ALLOWED = "TEMPORARY_NOT_ALLOWED";
    static final String CURRENCY_NOT_AVAILABLE = "CURRENCY_NOT_AVAILABLE";
    static final String INVALID_STATUS = "INVALID_STATUS";

    private static final long NO_ID = -1L;
    private static final Set<AccountType> NOT_IN_USE =
            EnumSet.of(AccountType.SUPPLIER, AccountType.GROUP, AccountType.CONSUMER);

    static final QueryDefinition QUERY = QueryDefinition.builder()
            .sortable("name", "type", "balance", "createdAt")
            .filterable("name", "type", "status", "parentId", "includeInBalance", "isTemporary", "hasCredit")
            .defaultSort(Sort.by("name"))
            .build();

    private final AccountRepository accountRepository;
    private final CreditRepository creditRepository;
    private final CurrencyRepository currencyRepository;
    private final AccountMapper accountMapper;
    private final CurrentUser currentUser;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AccountResponse> findAll(AccountFilter filter, PageParams params) {
        Specification<Account> spec = Specs.all(
                Specs.equal("userId", currentUser.id()),
                Specs.contains(filter.name(), "name"),
                Specs.in("type", filter.type()),
                filter.status() == null || filter.status().isEmpty()
                        ? Specs.notEqual("status", AccountStatus.DELETED)
                        : Specs.in("status", filter.status()),
                Specs.equal("parent.id", filter.parentId()),
                Specs.equal("includeInBalance", filter.includeInBalance()),
                Specs.equal("temporary", filter.isTemporary()),
                hasCredit(filter.hasCredit()));
        Page<Account> page = accountRepository.findAll(spec, QUERY.toPageable(params));
        Map<Long, Credit> credits = creditsOf(page.getContent());
        return PageResponse.of(page, account -> toResponse(account, credits.get(account.getId())), QUERY);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountOption> options() {
        Long userId = currentUser.id();
        List<Account> accounts = accountRepository.findByUserIdAndStatusAndTypeNotOrderByTypeAscNameAsc(
                userId, AccountStatus.ACTIVE, AccountType.GROUP);
        Map<Long, Credit> credits = creditsOf(accounts);
        Map<Long, LocalDateTime> lastOperations = accountRepository.findLastOperationDates(userId).stream()
                .collect(Collectors.toMap(
                        AccountRepository.LastOperation::getAccountId,
                        AccountRepository.LastOperation::getLastOperationDate));
        return accounts.stream()
                .map(account -> accountMapper.toOption(
                        account,
                        creditResponse(credits.get(account.getId()), account),
                        lastOperations.get(account.getId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountResponse> inUse() {
        List<Account> accounts =
                accountRepository
                        .findByUserIdAndStatusAndIncludeInBalanceTrueAndBalanceGreaterThanAndTypeNotInOrderByNameAsc(
                                currentUser.id(), AccountStatus.ACTIVE, BigDecimal.ZERO, NOT_IN_USE);
        Map<Long, Credit> credits = creditsOf(accounts);
        return accounts.stream()
                .map(account -> toResponse(account, credits.get(account.getId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountRef> parentOptions(AccountType type, Long accountId) {
        Set<Long> excluded = accountId == null ? Set.of() : accountRepository.findSubtreeIds(accountId);
        return accountRepository
                .findByUserIdAndStatusNotAndTypeInOrderByNameAsc(
                        currentUser.id(), AccountStatus.DELETED, AccountType.parentTypesOf(type))
                .stream()
                .filter(account -> !excluded.contains(account.getId()))
                .map(accountMapper::toRef)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AccountDetailResponse findById(Long id) {
        return detail(load(id));
    }

    @Override
    @Transactional
    public AccountDetailResponse create(AccountRequest request) {
        Account account = new Account();
        account.setUserId(currentUser.id());
        apply(account, request, true);
        accountRepository.saveAndFlush(account);
        log.info("Account {} ({}) created", account.getId(), account.getType());
        return detail(account);
    }

    @Override
    @Transactional
    public AccountDetailResponse update(Long id, AccountUpdateRequest request) {
        Account account = load(id);
        if (request.getVersion() != null && !request.getVersion().equals(account.getVersion())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Account " + id + " was modified");
        }
        apply(account, merge(account, request), false);
        accountRepository.saveAndFlush(account);
        return detail(account);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Account account = load(id);
        if (account.balanceOrZero().signum() != 0) {
            throw notDeletable(id, "BALANCE");
        }
        if (accountRepository.existsByParentIdAndStatusNot(id, AccountStatus.DELETED)) {
            throw notDeletable(id, "CHILDREN");
        }
        creditRepository.findByAccountId(id).ifPresent(creditRepository::delete);
        account.setStatus(AccountStatus.DELETED);
        log.info("Account {} deleted", id);
    }

    // ------------------------------------------------------------------ rules

    /**
     * Update = only the properties present in the request; everything else keeps its stored value. The result is a
     * complete request validated exactly like a creation. The id is never touched.
     */
    private static AccountRequest merge(Account account, AccountUpdateRequest update) {
        AccountType type = update.has("type") ? required(update.getType(), "type") : account.getType();
        Long currentParent =
                account.getParent() == null ? null : account.getParent().getId();
        boolean temporary = update.has("temporary") && update.getTemporary() != null
                ? update.getTemporary()
                : account.isTemporary() && type.canBeTemporary();
        return new AccountRequest(
                update.has("name") ? required(update.getName(), "name") : account.getName(),
                type,
                update.has("parentId") ? update.getParentId() : currentParent,
                update.has("currencyId")
                        ? required(update.getCurrencyId(), "currencyId")
                        : account.getCurrency().getId(),
                update.getBalance() != null ? update.getBalance() : account.getBalance(),
                update.has("icon") ? update.getIcon() : account.getIcon(),
                update.has("color") ? update.getColor() : account.getColor(),
                update.getIncludeInBalance() != null ? update.getIncludeInBalance() : account.isIncludeInBalance(),
                temporary,
                update.getStatus() != null ? update.getStatus() : account.getStatus(),
                update.getVersion());
    }

    private static <T> T required(T value, String field) {
        if (value == null) {
            throw BusinessException.fieldError(field, "NotNull");
        }
        return value;
    }

    private void apply(Account account, AccountRequest request, boolean creating) {
        AccountType type = request.type();
        String name = request.name().trim();
        long id = creating ? NO_ID : account.getId();

        if (accountRepository.existsByUserIdAndNameIgnoreCaseAndTypeAndStatusNotAndIdNot(
                account.getUserId(), name, type, AccountStatus.DELETED, id)) {
            throw BusinessException.fieldError("name", DUPLICATED);
        }
        if (request.status() == AccountStatus.DELETED) {
            throw BusinessException.fieldError("status", INVALID_STATUS);
        }
        if (Boolean.TRUE.equals(request.temporary()) && !type.canBeTemporary()) {
            throw BusinessException.fieldError("temporary", TEMPORARY_NOT_ALLOWED);
        }

        Account parent = parent(account, request.parentId(), type, creating);
        if (!creating && type != account.getType()) {
            checkTypeChange(account, type);
        }
        account.setCurrency(currency(account, request.currencyId()));
        account.setParent(parent);
        account.setName(name);
        account.setType(type);
        applyBalance(account, request);
        account.setIcon(request.icon());
        account.setColor(request.color() == null ? null : request.color().toUpperCase(Locale.ROOT));
        account.setIncludeInBalance(request.includeInBalance() == null || request.includeInBalance());
        account.setTemporary(Boolean.TRUE.equals(request.temporary()));
        if (creating || request.status() != null) {
            account.setStatus(request.status() == null ? AccountStatus.ACTIVE : request.status());
        }
    }

    /**
     * Manual balance edit: the value is overwritten without a transaction (the {@code @Version} bump lets open batch
     * drafts detect it). Types without balance store null.
     */
    private void applyBalance(Account account, AccountRequest request) {
        if (!request.type().hasBalance()) {
            account.setBalance(null);
            return;
        }
        account.setBalance(money(request.balance() != null ? request.balance() : account.balanceOrZero()));
    }

    /**
     * Type change rules:
     * <ul>
     *   <li>an account with a credit line must stay DEBTOR;
     *   <li>with sub-accounts or transactions only STORAGE ↔ INVESTMENT, and the new type must still accept every
     *       live sub-account;
     *   <li>switching to a type without balance requires a zero balance (no money silently dropped).
     * </ul>
     * The parent must always accept the new type (checked when resolving the parent).
     */
    private void checkTypeChange(Account account, AccountType newType) {
        if (newType != AccountType.DEBTOR && creditRepository.existsByAccountId(account.getId())) {
            throw BusinessException.fieldError("type", CREDIT_REQUIRES_DEBTOR);
        }
        Set<AccountType> childTypes = accountRepository.findChildTypes(account.getId(), AccountStatus.DELETED);
        if (!childTypes.isEmpty() || accountRepository.hasTransactions(account.getId())) {
            boolean allowed = AccountType.isFreeTypeChange(account.getType(), newType)
                    && newType.allowedChildren().containsAll(childTypes);
            if (!allowed) {
                throw BusinessException.fieldError("type", TYPE_CHANGE_NOT_ALLOWED);
            }
        }
        if (!newType.hasBalance() && account.balanceOrZero().signum() != 0) {
            throw BusinessException.fieldError("type", TYPE_CHANGE_REQUIRES_ZERO_BALANCE);
        }
    }

    private Currency currency(Account account, Long currencyId) {
        Currency current = account.getCurrency();
        if (current != null && current.getId().equals(currencyId)) {
            return current;
        }
        return currencyRepository
                .findById(currencyId)
                .filter(currency -> currency.getStatus() == CurrencyStatus.ACTIVE)
                .orElseThrow(() -> BusinessException.fieldError("currencyId", CURRENCY_NOT_AVAILABLE));
    }

    /** The parent must belong to the user, not be deleted, accept the type and not be in the account's subtree. */
    private Account parent(Account account, Long parentId, AccountType type, boolean creating) {
        if (parentId == null) {
            return null;
        }
        Account parent = accountRepository
                .findByIdAndUserId(parentId, account.getUserId())
                .filter(candidate -> !candidate.isDeleted())
                .filter(candidate -> candidate.getType().accepts(type))
                .orElseThrow(() -> BusinessException.fieldError("parentId", INVALID_PARENT));
        if (!creating && accountRepository.findSubtreeIds(account.getId()).contains(parentId)) {
            throw BusinessException.fieldError("parentId", PARENT_CYCLE);
        }
        return parent;
    }

    // ---------------------------------------------------------------- helpers

    private Account load(Long id) {
        return accountRepository
                .findByIdAndUserId(id, currentUser.id())
                .filter(account -> !account.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Account", id));
    }

    private AccountDetailResponse detail(Account account) {
        Credit credit = creditRepository.findByAccountId(account.getId()).orElse(null);
        Set<AccountType> childTypes = accountRepository.findChildTypes(account.getId(), AccountStatus.DELETED);
        return new AccountDetailResponse(
                toResponse(account, credit),
                !childTypes.isEmpty(),
                childTypes,
                accountRepository.hasTransactions(account.getId()));
    }

    private AccountResponse toResponse(Account account, Credit credit) {
        return accountMapper.toResponse(account, creditResponse(credit, account));
    }

    private static CreditResponse creditResponse(Credit credit, Account account) {
        return credit == null ? null : CreditResponse.of(credit, account.getBalance());
    }

    private Map<Long, Credit> creditsOf(Collection<Account> accounts) {
        List<Long> debtorIds = accounts.stream()
                .filter(account -> account.getType() == AccountType.DEBTOR)
                .map(Account::getId)
                .toList();
        if (debtorIds.isEmpty()) {
            return Map.of();
        }
        return creditRepository.findByAccountIdIn(debtorIds).stream()
                .collect(Collectors.toMap(credit -> credit.getAccount().getId(), Function.identity()));
    }

    private static Specification<Account> hasCredit(Boolean hasCredit) {
        if (hasCredit == null) {
            return null;
        }
        return (root, query, cb) -> {
            Subquery<Long> credits = Objects.requireNonNull(query).subquery(Long.class);
            var credit = credits.from(Credit.class);
            credits.select(credit.get("id")).where(cb.equal(credit.get("account"), root));
            return hasCredit ? cb.exists(credits) : cb.not(cb.exists(credits));
        };
    }

    private static BusinessException notDeletable(Long id, String reason) {
        return new BusinessException(
                ErrorCode.ACCOUNT_NOT_DELETABLE, "Account " + id + " cannot be deleted", Map.of("reason", reason));
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
