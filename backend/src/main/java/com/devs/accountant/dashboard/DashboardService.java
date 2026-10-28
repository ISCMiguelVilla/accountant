package com.devs.accountant.dashboard;

import com.devs.accountant.account.AccountType;
import com.devs.accountant.dashboard.dto.ExpensesByConceptResponse;
import com.devs.accountant.dashboard.dto.IncomeStatementResponse;
import com.devs.accountant.dashboard.dto.ProgressResponse;
import com.devs.accountant.dashboard.dto.SummaryResponse;
import com.devs.accountant.goal.Goal;
import com.devs.accountant.goal.GoalRepository;
import com.devs.accountant.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Home "Summary" tab (PROMPT 6.1): every figure only of the signed-in user. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    static final int MAX_YEARS = 10;

    private final DashboardRepository dashboardRepository;
    private final GoalRepository goalRepository;
    private final CurrentUser currentUser;
    private final Clock clock;

    public IncomeStatementResponse incomeStatement(Dimension dimension, Integer size, LocalDate reference) {
        Dimension effective = dimension == null ? Dimension.MONTH : dimension;
        int periods = effective.size(size);
        LocalDate ref = reference == null ? LocalDate.now(clock) : reference;
        LocalDate start = effective.windowStart(ref, periods);
        LocalDate last = effective.plus(start, periods - 1L);
        return new IncomeStatementResponse(
                effective, periods, ref, dashboardRepository.incomeStatement(currentUser.id(), effective, start, last));
    }

    public ExpensesByConceptResponse expensesByConcept(YearMonth month) {
        YearMonth effective = month == null ? YearMonth.now(clock) : month;
        List<ExpensesByConceptResponse.Concept> concepts = dashboardRepository.expensesByConcept(
                currentUser.id(),
                effective.atDay(1).atStartOfDay(),
                effective.plusMonths(1).atDay(1).atStartOfDay());
        BigDecimal total = concepts.stream()
                .map(ExpensesByConceptResponse.Concept::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ExpensesByConceptResponse(effective.toString(), total, concepts);
    }

    /** Debts (DEBTOR) are kept out of the tree and reported apart, so they do not add up with the money held. */
    public SummaryResponse summary() {
        List<AccountTree.Item> accounts = dashboardRepository.treeAccounts(currentUser.id());
        BigDecimal debt = accounts.stream()
                .filter(item -> item.type() == AccountType.DEBTOR)
                .map(AccountTree.Item::balance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SummaryResponse.Node> nodes = AccountTree.build(accounts.stream()
                .filter(item -> item.type() != AccountType.DEBTOR)
                .toList());
        BigDecimal assets = AccountTree.total(nodes);
        return new SummaryResponse(assets, debt, assets.subtract(debt), nodes);
    }

    /** Current year and the previous ones ({@code years} in total), newest first. */
    public List<ProgressResponse> progress(Integer years) {
        int count = years == null ? 3 : Math.clamp(years, 1, MAX_YEARS);
        LocalDate today = LocalDate.now(clock);
        int last = today.getYear();
        int first = last - count + 1;
        Long userId = currentUser.id();

        Map<Integer, BigDecimal> targets = goalRepository.findByUserIdAndYearBetween(userId, first, last).stream()
                .collect(Collectors.toMap(Goal::getYear, Goal::getTargetAmount));
        Map<Integer, Map<Integer, BigDecimal>> nets = new HashMap<>();
        for (DashboardRepository.MonthNet row : dashboardRepository.monthlyNets(userId, first, last)) {
            nets.computeIfAbsent(row.year(), key -> new HashMap<>()).put(row.month(), row.net());
        }
        return IntStream.rangeClosed(first, last)
                .map(year -> last - (year - first))
                .mapToObj(year -> GoalProgress.of(year, targets.get(year), nets.getOrDefault(year, Map.of()), today))
                .toList();
    }
}
