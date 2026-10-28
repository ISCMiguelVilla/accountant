package com.devs.accountant.schedule;

import com.devs.accountant.account.Account;
import com.devs.accountant.account.AccountRepository;
import com.devs.accountant.schedule.dto.ScheduleFilter;
import com.devs.accountant.schedule.dto.ScheduleRequest;
import com.devs.accountant.schedule.dto.ScheduleResponse;
import com.devs.accountant.schedule.dto.ScheduleStatusRequest;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.shared.paging.QueryDefinition;
import com.devs.accountant.shared.paging.Specs;
import com.devs.accountant.shared.security.CurrentUser;
import com.devs.accountant.transaction.engine.EngineAccount;
import com.devs.accountant.transaction.engine.EngineException;
import com.devs.accountant.transaction.engine.EngineTransaction;
import com.devs.accountant.transaction.engine.TransactionEngine;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleServiceImpl implements ScheduleService {

    static final String INVALID_STATUS = "INVALID_STATUS";
    private static final String CRON_FIELD = "cronExpression";

    static final QueryDefinition QUERY = QueryDefinition.builder()
            .sortable("nextExecution", "amount", "description")
            .filterable("type", "status", "accountId", "nextExecutionFrom", "nextExecutionTo", "description")
            .defaultSort(Sort.by(Sort.Order.asc("nextExecution"), Sort.Order.asc("id")))
            .build();

    private final ScheduleRepository scheduleRepository;
    private final AccountRepository accountRepository;
    private final ScheduleMapper scheduleMapper;
    private final CronService cronService;
    private final CurrentUser currentUser;
    private final Clock clock;

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ScheduleResponse> findAll(ScheduleFilter filter, PageParams params) {
        return PageResponse.of(
                scheduleRepository.findAll(spec(filter), QUERY.toPageable(params)), scheduleMapper::toResponse, QUERY);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleResponse> applicable() {
        LocalDateTime limit = LocalDate.now(clock).plusDays(2).atStartOfDay();
        return scheduleRepository
                .findByUserIdAndStatusAndNextExecutionBeforeOrderByNextExecutionAscIdAsc(
                        currentUser.id(), ScheduleStatus.ACTIVE, limit)
                .stream()
                .map(scheduleMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ScheduleResponse findById(Long id) {
        return scheduleMapper.toResponse(load(id));
    }

    // ---------------------------------------------------------------- commands

    @Override
    @Transactional
    public ScheduleResponse create(ScheduleRequest request) {
        Schedule schedule = new Schedule();
        schedule.setUserId(currentUser.id());
        apply(schedule, request, true);
        Schedule saved = scheduleRepository.save(schedule);
        log.info("Schedule {} created", saved.getId());
        return scheduleMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public ScheduleResponse update(Long id, ScheduleRequest request) {
        Schedule schedule = load(id);
        boolean cronChanged =
                !schedule.getCronExpression().equals(request.cronExpression().trim());
        apply(schedule, request, cronChanged);
        return scheduleMapper.toResponse(schedule);
    }

    @Override
    @Transactional
    public ScheduleResponse changeStatus(Long id, ScheduleStatusRequest request) {
        if (request.status() == ScheduleStatus.DELETED) {
            throw BusinessException.fieldError("status", INVALID_STATUS);
        }
        Schedule schedule = load(id);
        schedule.setStatus(request.status());
        return scheduleMapper.toResponse(schedule);
    }

    @Override
    @Transactional
    public ScheduleResponse skip(Long id) {
        Schedule schedule = load(id);
        LocalDateTime next =
                cronService.parse(schedule.getCronExpression(), CRON_FIELD).next(schedule.getNextExecution());
        if (next == null) {
            throw BusinessException.fieldError(CRON_FIELD, CronService.INVALID_CRON);
        }
        schedule.setNextExecution(next);
        return scheduleMapper.toResponse(schedule);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        load(id).setStatus(ScheduleStatus.DELETED);
        log.info("Schedule {} deleted", id);
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Copies the request validating it with the same rules as a normal transaction. {@code recomputeNext}: without an
     * explicit {@code nextExecution}, the first occurrence of the cron from today (today included).
     */
    private void apply(Schedule schedule, ScheduleRequest request, boolean recomputeNext) {
        CronExpression cron = cronService.parse(request.cronExpression(), CRON_FIELD);
        Account origin = usableAccount(request.originAccountId(), "originAccountId");
        Account destination = request.destinationAccountId() == null
                ? null
                : usableAccount(request.destinationAccountId(), "destinationAccountId");
        BigDecimal fee = request.fee() == null ? BigDecimal.ZERO : request.fee();
        checkRules(request, origin, destination, fee);

        schedule.setType(request.type());
        schedule.setOrigin(origin);
        schedule.setDestination(destination);
        schedule.setAmount(request.amount());
        schedule.setFee(fee);
        schedule.setDescription(request.description().trim());
        schedule.setCronExpression(request.cronExpression().trim());
        if (request.nextExecution() != null) {
            schedule.setNextExecution(request.nextExecution());
        } else if (recomputeNext || schedule.getNextExecution() == null) {
            schedule.setNextExecution(cronService
                    .nextOnOrAfter(cron, LocalDate.now(clock), CRON_FIELD)
                    .atStartOfDay());
        }
    }

    /** Matrix, destination mode, enabled fee and active accounts: exactly the normal transaction rules. */
    private static void checkRules(ScheduleRequest request, Account origin, Account destination, BigDecimal fee) {
        EngineTransaction definition = new EngineTransaction(
                "schedule",
                0,
                request.type(),
                origin.getId(),
                destination == null ? null : destination.getId(),
                request.amount(),
                fee,
                true,
                LocalDateTime.MIN);
        try {
            TransactionEngine.checkRules(definition, engineAccount(origin), engineAccount(destination));
        } catch (EngineException ex) {
            if (ex.getField() != null) {
                throw BusinessException.fieldError(ex.getField(), ex.getFieldCode());
            }
            throw new BusinessException(
                    ErrorCode.valueOf(ex.getError().name()), ex.getMessage(), ex.getParams(), null, Map.of());
        }
    }

    private static EngineAccount engineAccount(Account account) {
        return account == null
                ? null
                : new EngineAccount(
                        account.getId(),
                        account.getType(),
                        account.getStatus(),
                        account.getBalance(),
                        null,
                        account.isTemporary());
    }

    private Account usableAccount(Long id, String field) {
        return accountRepository
                .findByIdAndUserId(id, currentUser.id())
                .filter(account -> !account.isDeleted())
                .orElseThrow(() -> BusinessException.fieldError(field, TransactionEngine.ACCOUNT_NOT_FOUND));
    }

    private Schedule load(Long id) {
        return scheduleRepository
                .findByIdAndUserId(id, currentUser.id())
                .filter(schedule -> schedule.getStatus() != ScheduleStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Schedule", id));
    }

    private Specification<Schedule> spec(ScheduleFilter filter) {
        return Specs.all(
                Specs.equal("userId", currentUser.id()),
                Specs.in("type", filter.type()),
                filter.status() == null || filter.status().isEmpty()
                        ? Specs.notEqual("status", ScheduleStatus.DELETED)
                        : Specs.in("status", filter.status()),
                filter.accountId() == null
                        ? null
                        : (root, query, cb) -> cb.or(
                                cb.equal(root.get("origin").get("id"), filter.accountId()),
                                cb.equal(root.get("destination").get("id"), filter.accountId())),
                filter.nextExecutionFrom() == null
                        ? null
                        : (root, query, cb) -> cb.greaterThanOrEqualTo(
                                root.get("nextExecution"),
                                filter.nextExecutionFrom().atStartOfDay()),
                filter.nextExecutionTo() == null
                        ? null
                        : (root, query, cb) -> cb.lessThan(
                                root.get("nextExecution"),
                                filter.nextExecutionTo().plusDays(1).atStartOfDay()),
                Specs.contains(filter.description(), "description"));
    }
}
