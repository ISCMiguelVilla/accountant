package com.devs.accountant.transaction;

import com.devs.accountant.account.Account;
import com.devs.accountant.account.AccountRepository;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.credit.Credit;
import com.devs.accountant.credit.CreditRepository;
import com.devs.accountant.schedule.CronService;
import com.devs.accountant.schedule.Schedule;
import com.devs.accountant.schedule.ScheduleRepository;
import com.devs.accountant.schedule.ScheduleStatus;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.shared.paging.QueryDefinition;
import com.devs.accountant.shared.paging.Specs;
import com.devs.accountant.shared.security.CurrentUser;
import com.devs.accountant.transaction.dto.BatchRequest;
import com.devs.accountant.transaction.dto.BatchResponse;
import com.devs.accountant.transaction.dto.TransactionFilter;
import com.devs.accountant.transaction.dto.TransactionRequest;
import com.devs.accountant.transaction.dto.TransactionResponse;
import com.devs.accountant.transaction.dto.TransactionRulesResponse;
import com.devs.accountant.transaction.engine.DestinationMode;
import com.devs.accountant.transaction.engine.EngineAccount;
import com.devs.accountant.transaction.engine.EngineException;
import com.devs.accountant.transaction.engine.EngineResult;
import com.devs.accountant.transaction.engine.EngineTransaction;
import com.devs.accountant.transaction.engine.Side;
import com.devs.accountant.transaction.engine.TransactionEngine;
import com.devs.accountant.transaction.engine.TransactionRules;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionServiceImpl implements TransactionService {

    static final String DUPLICATED = "DUPLICATED";
    static final String INVALID_SCHEDULE = "INVALID_SCHEDULE";
    static final String SCHEDULE_MISMATCH = "SCHEDULE_MISMATCH";

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("operationDate"), Sort.Order.desc("id"));

    static final QueryDefinition QUERY = QueryDefinition.builder()
            .sortable("operationDate", "originAppliedAt", "destinationAppliedAt", "amount", "type", "createdAt")
            .filterable(
                    "type",
                    "operationType",
                    "accountId",
                    "originId",
                    "destinationId",
                    "applied",
                    "dateFrom",
                    "dateTo",
                    "amountMin",
                    "amountMax",
                    "description",
                    "batchUuid")
            .defaultSort(NEWEST_FIRST)
            .build();

    static final QueryDefinition ACCOUNT_QUERY = QueryDefinition.builder()
            .sortable("operationDate", "originAppliedAt", "destinationAppliedAt", "amount", "type", "createdAt")
            .defaultSort(NEWEST_FIRST)
            .defaultSize(10)
            .build();

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final CreditRepository creditRepository;
    private final ScheduleRepository scheduleRepository;
    private final TransactionMapper transactionMapper;
    private final CronService cronService;
    private final CurrentUser currentUser;
    private final Clock clock;

    // ------------------------------------------------------------------ queries

    @Override
    public TransactionRulesResponse rules() {
        List<TransactionRulesResponse.TypeRule> types = Arrays.stream(TransactionType.values())
                .map(type -> {
                    TransactionRules.Rule rule = TransactionRules.of(type);
                    List<AccountType> origins = sorted(rule.origins());
                    List<AccountType> destinations = sorted(rule.destinations());
                    List<AccountType> variantDestinations = new ArrayList<>(destinations);
                    if (rule.destinationMode() != DestinationMode.REQUIRED) {
                        variantDestinations.add(null);
                    }
                    List<TransactionRulesResponse.Variant> variants = new ArrayList<>();
                    for (AccountType origin : origins) {
                        for (AccountType destination : variantDestinations) {
                            variants.add(new TransactionRulesResponse.Variant(
                                    origin,
                                    destination,
                                    TransactionRules.operationType(type, origin, destination),
                                    TransactionRules.feeEnabled(type, destination),
                                    TransactionRules.feeMustBeBelowAmount(type, destination),
                                    TransactionRules.feeSide(type, destination)));
                        }
                    }
                    return new TransactionRulesResponse.TypeRule(
                            type,
                            origins,
                            destinations,
                            rule.destinationMode(),
                            rule.originPendingAllowed(),
                            rule.destinationPendingAllowed(),
                            variants);
                })
                .toList();
        return new TransactionRulesResponse(types);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> findAll(TransactionFilter filter, PageParams params) {
        return PageResponse.of(
                transactionRepository.findAll(spec(filter), QUERY.toPageable(params)),
                transactionMapper::toResponse,
                QUERY);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> findByAccount(Long accountId, PageParams params) {
        accountRepository
                .findByIdAndUserId(accountId, currentUser.id())
                .filter(account -> !account.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Account", accountId));
        return PageResponse.of(
                transactionRepository.findAll(
                        spec(TransactionFilter.ofAccount(accountId)), ACCOUNT_QUERY.toPageable(params)),
                transactionMapper::toResponse,
                ACCOUNT_QUERY);
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionResponse findById(Long id) {
        return transactionMapper.toResponse(load(id));
    }

    // -------------------------------------------------------------------- batch

    @Override
    @Transactional
    public BatchResponse saveBatch(BatchRequest request) {
        Long userId = currentUser.id();
        List<TransactionRequest> requests = request.transactions();
        checkUniqueUuids(requests);

        // 1. Lock every involved account (id order → no deadlocks) and check ownership, existence and versions.
        Set<Long> ids = new TreeSet<>();
        requests.forEach(tx -> {
            ids.add(tx.originAccountId());
            if (tx.destinationAccountId() != null) {
                ids.add(tx.destinationAccountId());
            }
        });
        Map<Long, Account> accounts = accountRepository.lockForUpdate(userId, ids).stream()
                .filter(account -> !account.isDeleted())
                .collect(Collectors.toMap(Account::getId, Function.identity()));
        checkAccountsExist(requests, accounts);
        checkVersions(request.accountVersions(), accounts);

        // 2. Dates cannot be earlier than the last persisted transaction of each involved account.
        checkDates(requests, ids);

        // 3. Scheduled transactions must exist and match the request.
        Map<Long, Schedule> schedules = schedules(userId, requests);

        // 4. Compute everything with the engine; any failure rolls back the whole batch.
        Map<Long, BigDecimal> limits = creditLimits(accounts.values());
        List<EngineAccount> engineAccounts = accounts.values().stream()
                .map(account -> toEngine(account, limits.get(account.getId())))
                .toList();
        List<EngineTransaction> engineTransactions = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            engineTransactions.add(toEngine(requests.get(i), i));
        }
        TransactionEngine.BatchResult result;
        try {
            result = TransactionEngine.project(engineAccounts, engineTransactions);
        } catch (EngineException ex) {
            throw toBusiness(ex);
        }

        // 5. Persist transactions (date order) and the resulting account states.
        UUID batchUuid = UUID.randomUUID();
        List<Transaction> saved = new ArrayList<>();
        for (EngineResult computed : result.results()) {
            TransactionRequest source = requests.get(computed.transaction().index());
            saved.add(toEntity(userId, batchUuid, source, computed, accounts));
        }
        transactionRepository.saveAll(saved);
        result.accounts().values().forEach(state -> {
            Account account = accounts.get(state.id());
            account.setBalance(state.balance());
            account.setStatus(state.status());
        });

        // 6. Advance the scheduled transactions that were executed.
        saved.stream()
                .filter(tx -> tx.getScheduleId() != null)
                .forEach(tx -> advance(schedules.get(tx.getScheduleId()), tx.getOperationDate()));

        log.info("Batch {} saved with {} transaction(s)", batchUuid, saved.size());
        return new BatchResponse(
                batchUuid, saved.stream().map(transactionMapper::toResponse).toList());
    }

    // -------------------------------------------------------------------- apply

    @Override
    @Transactional
    public TransactionResponse apply(Long id, Side side) {
        Transaction transaction = load(id);
        if (transaction.isFullyApplied()) {
            return transactionMapper.toResponse(transaction);
        }
        Set<Side> sides = side == null ? EnumSet.allOf(Side.class) : EnumSet.of(side);
        Set<Long> ids = new TreeSet<>();
        ids.add(transaction.getOrigin().getId());
        if (transaction.getDestination() != null) {
            ids.add(transaction.getDestination().getId());
        }
        Map<Long, Account> accounts = accountRepository.lockForUpdate(currentUser.id(), ids).stream()
                .collect(Collectors.toMap(Account::getId, Function.identity()));
        Map<Long, BigDecimal> limits = creditLimits(accounts.values());
        Account origin = accounts.get(transaction.getOrigin().getId());
        Account destination = transaction.getDestination() == null
                ? null
                : accounts.get(transaction.getDestination().getId());
        EngineAccount originState = toEngine(origin, limits.get(origin.getId()));
        EngineAccount destinationState =
                destination == null ? null : toEngine(destination, limits.get(destination.getId()));

        EngineTransaction engineTransaction = new EngineTransaction(
                transaction.getUuid().toString(),
                0,
                transaction.getType(),
                origin.getId(),
                destination == null ? null : destination.getId(),
                transaction.getAmount(),
                transaction.getFee(),
                transaction.isOriginApplied(),
                transaction.getDestinationApplied(),
                transaction.getOperationDate());
        TransactionEngine.ApplyResult applied;
        try {
            applied = TransactionEngine.applyPending(engineTransaction, originState, destinationState, sides);
        } catch (EngineException ex) {
            throw toBusiness(ex);
        }

        // Each side applied now gets the balances and the date of this moment.
        LocalDateTime now = LocalDateTime.now(clock);
        if (applied.appliedSides().contains(Side.ORIGIN)) {
            origin.setBalance(originState.balance());
            origin.setStatus(originState.status());
            transaction.setOriginBalanceBefore(applied.originBalanceBefore());
            transaction.setOriginBalanceAfter(applied.originBalanceAfter());
            transaction.setOriginApplied(true);
            transaction.setOriginAppliedAt(now);
        }
        if (applied.appliedSides().contains(Side.DESTINATION)) {
            destination.setBalance(destinationState.balance());
            transaction.setDestinationBalanceBefore(applied.destinationBalanceBefore());
            transaction.setDestinationBalanceAfter(applied.destinationBalanceAfter());
            transaction.setDestinationApplied(true);
            transaction.setDestinationAppliedAt(now);
        }
        log.info("Transaction {}: applied {}", id, applied.appliedSides());
        return transactionMapper.toResponse(transaction);
    }

    // ------------------------------------------------------------------ helpers

    private void checkUniqueUuids(List<TransactionRequest> requests) {
        Set<UUID> seen = new HashSet<>();
        for (int i = 0; i < requests.size(); i++) {
            if (!seen.add(requests.get(i).uuid())) {
                throw BusinessException.fieldError("transactions[" + i + "].uuid", DUPLICATED);
            }
        }
        List<UUID> existing = transactionRepository.findExistingUuids(seen);
        if (!existing.isEmpty()) {
            int index = indexOf(requests, tx -> existing.contains(tx.uuid()));
            throw BusinessException.fieldError("transactions[" + index + "].uuid", DUPLICATED);
        }
    }

    private void checkAccountsExist(List<TransactionRequest> requests, Map<Long, Account> accounts) {
        for (TransactionRequest tx : requests) {
            for (Long id : new Long[] {tx.originAccountId(), tx.destinationAccountId()}) {
                if (id != null && !accounts.containsKey(id)) {
                    throw new BusinessException(
                            ErrorCode.RESOURCE_NOT_FOUND,
                            "Account " + id + " not found",
                            Map.of("resource", "Account", "id", String.valueOf(id)),
                            tx.uuid().toString());
                }
            }
        }
    }

    private void checkVersions(Map<Long, Long> versions, Map<Long, Account> accounts) {
        if (versions == null) {
            return;
        }
        versions.forEach((id, version) -> {
            Account account = accounts.get(id);
            if (account != null && version != null && !version.equals(account.getVersion())) {
                throw new BusinessException(
                        ErrorCode.CONFLICT, "Account " + id + " changed since the draft", Map.of("accountId", id));
            }
        });
    }

    private void checkDates(List<TransactionRequest> requests, Set<Long> ids) {
        Map<Long, LocalDateTime> last = new HashMap<>();
        accountRepository
                .findLastOperationDatesOf(ids)
                .forEach(row -> last.put(row.getAccountId(), row.getLastOperationDate()));
        for (int i = 0; i < requests.size(); i++) {
            TransactionRequest tx = requests.get(i);
            for (Long id : new Long[] {tx.originAccountId(), tx.destinationAccountId()}) {
                LocalDateTime lastDate = id == null ? null : last.get(id);
                if (lastDate != null && tx.operationDate().isBefore(lastDate)) {
                    throw new BusinessException(
                            ErrorCode.DATE_BEFORE_LAST_TRANSACTION,
                            "Date before the last transaction of account " + id,
                            Map.of("accountId", id, "lastOperationDate", lastDate.toString(), "index", i),
                            tx.uuid().toString());
                }
            }
        }
    }

    private Map<Long, Schedule> schedules(Long userId, List<TransactionRequest> requests) {
        Set<Long> ids = requests.stream()
                .map(TransactionRequest::scheduleId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Schedule> schedules =
                scheduleRepository.findByUserIdAndIdInAndStatusNot(userId, ids, ScheduleStatus.DELETED).stream()
                        .collect(Collectors.toMap(Schedule::getId, Function.identity()));
        Set<Long> used = new HashSet<>();
        for (int i = 0; i < requests.size(); i++) {
            TransactionRequest tx = requests.get(i);
            if (tx.scheduleId() == null) {
                continue;
            }
            String field = "transactions[" + i + "].scheduleId";
            Schedule schedule = schedules.get(tx.scheduleId());
            if (schedule == null) {
                throw BusinessException.fieldError(field, INVALID_SCHEDULE);
            }
            if (!used.add(tx.scheduleId())) {
                throw BusinessException.fieldError(field, DUPLICATED);
            }
            Long scheduleDestination = schedule.getDestination() == null
                    ? null
                    : schedule.getDestination().getId();
            if (schedule.getType() != tx.type()
                    || !schedule.getOrigin().getId().equals(tx.originAccountId())
                    || !Objects.equals(scheduleDestination, tx.destinationAccountId())) {
                throw BusinessException.fieldError(field, SCHEDULE_MISMATCH);
            }
        }
        return schedules;
    }

    /** {@code last_execution = operation_date}, {@code next_execution = cron.next(previous next_execution)}. */
    private void advance(Schedule schedule, LocalDateTime executedAt) {
        LocalDateTime next = cronService
                .parse(schedule.getCronExpression(), "cronExpression")
                .next(schedule.getNextExecution());
        schedule.setLastExecution(executedAt);
        if (next != null) {
            schedule.setNextExecution(next);
        }
    }

    private Map<Long, BigDecimal> creditLimits(java.util.Collection<Account> accounts) {
        List<Long> debtors = accounts.stream()
                .filter(account -> account.getType() == AccountType.DEBTOR)
                .map(Account::getId)
                .toList();
        if (debtors.isEmpty()) {
            return Map.of();
        }
        return creditRepository.findByAccountIdIn(debtors).stream()
                .collect(Collectors.toMap(credit -> credit.getAccount().getId(), Credit::getCreditLimit));
    }

    private static EngineAccount toEngine(Account account, BigDecimal creditLimit) {
        return new EngineAccount(
                account.getId(),
                account.getType(),
                account.getStatus(),
                account.getBalance(),
                creditLimit,
                account.isTemporary());
    }

    private static EngineTransaction toEngine(TransactionRequest tx, int index) {
        return new EngineTransaction(
                tx.uuid().toString(),
                index,
                tx.type(),
                tx.originAccountId(),
                tx.destinationAccountId(),
                tx.amount(),
                tx.fee(),
                tx.isOriginApplied(),
                tx.destinationAccountId() == null ? null : tx.isDestinationApplied(),
                tx.operationDate());
    }

    private static Transaction toEntity(
            Long userId,
            UUID batchUuid,
            TransactionRequest source,
            EngineResult computed,
            Map<Long, Account> accounts) {
        EngineTransaction tx = computed.transaction();
        Transaction entity = new Transaction();
        entity.setUserId(userId);
        entity.setUuid(source.uuid());
        entity.setBatchUuid(batchUuid);
        entity.setScheduleId(source.scheduleId());
        entity.setType(tx.type());
        entity.setOperationType(computed.operationType());
        entity.setOrigin(accounts.get(tx.originId()));
        entity.setDestination(tx.destinationId() == null ? null : accounts.get(tx.destinationId()));
        entity.setAmount(tx.amount());
        entity.setFee(tx.fee());
        entity.setReportedAmount(computed.reportedAmount());
        entity.setDescription(source.description().trim());
        entity.setOriginBalanceBefore(computed.originBalanceBefore());
        entity.setOriginBalanceAfter(computed.originBalanceAfter());
        entity.setDestinationBalanceBefore(computed.destinationBalanceBefore());
        entity.setDestinationBalanceAfter(computed.destinationBalanceAfter());
        entity.setOperationDate(tx.operationDate());
        entity.setOriginApplied(tx.originApplied());
        entity.setOriginAppliedAt(tx.originApplied() ? tx.operationDate() : null);
        entity.setDestinationApplied(tx.destinationApplied());
        entity.setDestinationAppliedAt(Boolean.TRUE.equals(tx.destinationApplied()) ? tx.operationDate() : null);
        return entity;
    }

    /** Engine failure → API error with the failing transaction uuid and request index. */
    static BusinessException toBusiness(EngineException ex) {
        Map<String, Object> params = new LinkedHashMap<>(ex.getParams());
        params.put("index", ex.getIndex());
        Map<String, String> errors = ex.getField() == null ? Map.of() : Map.of(ex.getField(), ex.getFieldCode());
        return new BusinessException(
                ErrorCode.valueOf(ex.getError().name()), ex.getMessage(), params, ex.getTransactionUuid(), errors);
    }

    private Transaction load(Long id) {
        return transactionRepository
                .findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
    }

    private Specification<Transaction> spec(TransactionFilter filter) {
        return Specs.all(
                Specs.equal("userId", currentUser.id()),
                Specs.in("type", filter.type()),
                Specs.equal("operationType", filter.operationType()),
                involving(filter.accountId()),
                Specs.equal("origin.id", filter.originId()),
                Specs.equal("destination.id", filter.destinationId()),
                applied(filter.applied()),
                filter.dateFrom() == null
                        ? null
                        : (root, query, cb) -> cb.greaterThanOrEqualTo(
                                root.get("operationDate"), filter.dateFrom().atStartOfDay()),
                filter.dateTo() == null
                        ? null
                        : (root, query, cb) -> cb.lessThan(
                                root.get("operationDate"),
                                filter.dateTo().plusDays(1).atStartOfDay()),
                filter.amountMin() == null
                        ? null
                        : (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("amount"), filter.amountMin()),
                filter.amountMax() == null
                        ? null
                        : (root, query, cb) -> cb.lessThanOrEqualTo(root.get("amount"), filter.amountMax()),
                Specs.contains(filter.description(), "description"),
                Specs.equal("batchUuid", filter.batchUuid()));
    }

    /** true = fully applied; false = some side still pending. */
    private static Specification<Transaction> applied(Boolean applied) {
        if (applied == null) {
            return null;
        }
        return (root, query, cb) -> {
            var pending = cb.or(cb.isFalse(root.get("originApplied")), cb.isFalse(root.get("destinationApplied")));
            return applied ? cb.not(pending) : pending;
        };
    }

    /** Origin or destination. */
    private static Specification<Transaction> involving(Long accountId) {
        if (accountId == null) {
            return null;
        }
        return (root, query, cb) -> cb.or(
                cb.equal(root.get("origin").get("id"), accountId),
                cb.equal(root.get("destination").get("id"), accountId));
    }

    private static List<AccountType> sorted(Set<AccountType> types) {
        return types.stream().sorted(Comparator.naturalOrder()).toList();
    }

    private static <T> int indexOf(List<T> list, java.util.function.Predicate<T> predicate) {
        for (int i = 0; i < list.size(); i++) {
            if (predicate.test(list.get(i))) {
                return i;
            }
        }
        return -1;
    }
}
