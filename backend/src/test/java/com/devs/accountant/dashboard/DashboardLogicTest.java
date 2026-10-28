package com.devs.accountant.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.devs.accountant.account.AccountType;
import com.devs.accountant.dashboard.dto.ProgressResponse;
import com.devs.accountant.dashboard.dto.SummaryResponse.Node;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Pure logic of the home summary: window of periods, account tree and goal progress. */
class DashboardLogicTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 27);

    // ------------------------------------------------------------- window

    @Test
    void windowIsCenteredOnTheReferenceAndSizesAreClamped() {
        assertThat(Dimension.MONTH.size(null)).isEqualTo(6);
        assertThat(Dimension.MONTH.size(40)).isEqualTo(12);
        assertThat(Dimension.YEAR.size(1)).isEqualTo(2);

        assertThat(Dimension.MONTH.windowStart(TODAY, 6)).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Dimension.YEAR.windowStart(TODAY, 2)).isEqualTo(LocalDate.of(2025, 1, 1));
        // 2026-10-27 is a Tuesday: its week starts Monday 26th.
        assertThat(Dimension.WEEK.windowStart(TODAY, 4)).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(Dimension.DAY.windowStart(TODAY, 7)).isEqualTo(LocalDate.of(2026, 10, 24));
    }

    // --------------------------------------------------------------- tree

    @Test
    void treeTotalsPruneZerosCollapseSingleLeavesAndComputeShares() {
        List<Node> nodes = AccountTree.build(List.of(
                item(1, null, "Bancos", AccountType.GROUP, null),
                item(2, 1L, "Nómina", AccountType.STORAGE, "6000"),
                item(3, 1L, "Ahorro", AccountType.STORAGE, "2000"),
                item(4, 3L, "Apartado", AccountType.STORAGE, "0"),
                item(5, null, "Inversiones", AccountType.GROUP, null),
                item(6, 5L, "CETES", AccountType.INVESTMENT, "2000"),
                item(7, null, "Vacía", AccountType.GROUP, null),
                item(8, 7L, "Sin saldo", AccountType.STORAGE, "0")));

        assertThat(nodes).extracting(Node::name).containsExactly("Bancos", "Inversiones › CETES");
        Node banks = nodes.getFirst();
        assertThat(banks.total()).isEqualByComparingTo("8000");
        assertThat(banks.percentage()).isEqualByComparingTo("80.00");
        // "Apartado" (0) was pruned, so "Ahorro" is a leaf now.
        assertThat(banks.children()).extracting(Node::name).containsExactly("Nómina", "Ahorro");
        assertThat(banks.children())
                .extracting(Node::percentage)
                .containsExactly(new BigDecimal("75.00"), new BigDecimal("25.00"));
        Node investments = nodes.get(1);
        assertThat(investments.id()).isEqualTo(6L);
        assertThat(investments.children()).isEmpty();
        assertThat(AccountTree.total(nodes)).isEqualByComparingTo("10000");
    }

    // ----------------------------------------------------------- progress

    @Test
    void progressOfTheCurrentYearWithGoal() {
        // Goal 12,000: 1,000 per month; 10 months elapsed → expected 10,000.
        ProgressResponse progress = GoalProgress.of(
                2026,
                new BigDecimal("12000"),
                Map.of(
                        1,
                        new BigDecimal("1500"),
                        2,
                        new BigDecimal("400"),
                        3,
                        new BigDecimal("-200"),
                        11,
                        new BigDecimal("50")),
                TODAY);

        assertThat(progress.monthlyTarget()).isEqualByComparingTo("1000");
        assertThat(progress.expected()).isEqualByComparingTo("10000");
        assertThat(progress.accumulated()).isEqualByComparingTo("1750");
        assertThat(progress.percentage()).isEqualByComparingTo("14.58");
        assertThat(progress.status()).isEqualTo(ProgressStatus.DANGER);
        assertThat(progress.months())
                .extracting(ProgressResponse.Month::status)
                .containsExactly(
                        ProgressStatus.SUCCESS,
                        ProgressStatus.WARNING,
                        ProgressStatus.DANGER,
                        ProgressStatus.WARNING,
                        ProgressStatus.WARNING,
                        ProgressStatus.WARNING,
                        ProgressStatus.WARNING,
                        ProgressStatus.WARNING,
                        ProgressStatus.WARNING,
                        ProgressStatus.WARNING,
                        null,
                        null);
    }

    @Test
    void pastYearsUseTwelveMonthsAndThePercentageIsCapped() {
        ProgressResponse done = GoalProgress.of(2025, new BigDecimal("1200"), Map.of(6, new BigDecimal("5000")), TODAY);
        assertThat(done.expected()).isEqualByComparingTo("1200");
        assertThat(done.percentage()).isEqualByComparingTo("100");
        assertThat(done.status()).isEqualTo(ProgressStatus.SUCCESS);

        ProgressResponse half = GoalProgress.of(2025, new BigDecimal("1200"), Map.of(6, new BigDecimal("700")), TODAY);
        assertThat(half.status()).isEqualTo(ProgressStatus.WARNING);

        ProgressResponse negative =
                GoalProgress.of(2025, new BigDecimal("1200"), Map.of(6, new BigDecimal("-10")), TODAY);
        assertThat(negative.percentage()).isEqualByComparingTo("0");
    }

    @Test
    void yearsWithoutGoalOnlyHaveNets() {
        ProgressResponse progress = GoalProgress.of(2024, null, Map.of(3, new BigDecimal("80")), TODAY);

        assertThat(progress.target()).isNull();
        assertThat(progress.percentage()).isNull();
        assertThat(progress.status()).isNull();
        assertThat(progress.accumulated()).isEqualByComparingTo("80");
        assertThat(progress.months())
                .allSatisfy(month -> assertThat(month.status()).isNull());
    }

    private static AccountTree.Item item(long id, Long parent, String name, AccountType type, String balance) {
        return new AccountTree.Item(
                id, parent, name, type, null, null, balance == null ? BigDecimal.ZERO : new BigDecimal(balance));
    }
}
