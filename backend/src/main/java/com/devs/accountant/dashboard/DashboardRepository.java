package com.devs.accountant.dashboard;

import com.devs.accountant.account.AccountType;
import com.devs.accountant.dashboard.dto.ExpensesByConceptResponse;
import com.devs.accountant.dashboard.dto.IncomeStatementResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Report queries in Postgres. Every amount follows docs/documentacion-tecnica.md §9.5: income = ADDITION {@code amount − fee}; expense =
 * SUBTRACTION {@code amount + fee} plus the {@code fee} of NEUTER. Only applied transactions, by {@code applied_at}.
 */
@Repository
@RequiredArgsConstructor
public class DashboardRepository {

    static final String INCOME = "CASE WHEN t.operation_type = 'ADDITION' THEN t.amount - t.fee ELSE 0 END";
    static final String EXPENSE = "CASE WHEN t.operation_type = 'SUBTRACTION' THEN t.amount + t.fee"
            + " WHEN t.operation_type = 'NEUTER' THEN t.fee ELSE 0 END";

    private final JdbcClient jdbc;

    public record MonthNet(int year, int month, BigDecimal net) {}

    public record DayAmounts(LocalDate date, BigDecimal income, BigDecimal expense) {}

    /** Income and expense per day with applied transactions (days without them are absent). */
    public List<DayAmounts> dailyAmounts(Long userId, LocalDateTime from, LocalDateTime to) {
        return jdbc.sql("""
                        SELECT CAST(t.applied_at AS date) AS day, SUM(%s) AS income, SUM(%s) AS expense
                        FROM transactions t
                        WHERE t.user_id = :userId AND t.applied = TRUE
                          AND t.applied_at >= :from AND t.applied_at < :to
                        GROUP BY 1
                        """.formatted(INCOME, EXPENSE))
                .param("userId", userId)
                .param("from", from)
                .param("to", to)
                .query((rs, row) -> new DayAmounts(
                        rs.getDate("day").toLocalDate(), rs.getBigDecimal("income"), rs.getBigDecimal("expense")))
                .list();
    }

    public List<IncomeStatementResponse.Period> incomeStatement(
            Long userId, Dimension dimension, LocalDate start, LocalDate last) {
        return jdbc.sql("""
                        WITH periods AS (
                            SELECT generate_series(CAST(:start AS timestamp), CAST(:last AS timestamp),
                                                   CAST(:step AS interval)) AS period_start
                        )
                        SELECT p.period_start,
                               COALESCE(SUM(%s), 0) AS income,
                               COALESCE(SUM(%s), 0) AS expense
                        FROM periods p
                        LEFT JOIN transactions t
                               ON t.user_id = :userId AND t.applied = TRUE
                              AND t.applied_at >= p.period_start
                              AND t.applied_at < p.period_start + CAST(:step AS interval)
                        GROUP BY p.period_start
                        ORDER BY p.period_start
                        """.formatted(INCOME, EXPENSE))
                .param("start", start.atStartOfDay())
                .param("last", last.atStartOfDay())
                .param("step", dimension.interval())
                .param("userId", userId)
                .query((rs, row) -> {
                    BigDecimal income = rs.getBigDecimal("income");
                    BigDecimal expense = rs.getBigDecimal("expense");
                    return new IncomeStatementResponse.Period(
                            rs.getTimestamp("period_start").toLocalDateTime().toLocalDate(),
                            income,
                            expense,
                            income.subtract(expense));
                })
                .list();
    }

    public List<ExpensesByConceptResponse.Concept> expensesByConcept(
            Long userId, LocalDateTime from, LocalDateTime to) {
        return jdbc.sql("""
                        SELECT c.account_id, a.name, a.icon, a.color, c.amount
                        FROM (
                            SELECT CASE WHEN t.operation_type = 'NEUTER' THEN NULL
                                        WHEN t.type = 'INTEREST' THEN t.origin_account_id
                                        ELSE t.destination_account_id END AS account_id,
                                   SUM(CASE WHEN t.operation_type = 'NEUTER' THEN t.fee
                                            ELSE t.amount + t.fee END) AS amount
                            FROM transactions t
                            WHERE t.user_id = :userId AND t.applied = TRUE
                              AND t.applied_at >= :from AND t.applied_at < :to
                              AND (t.operation_type = 'SUBTRACTION'
                                   OR (t.operation_type = 'NEUTER' AND t.fee > 0))
                            GROUP BY 1
                        ) c
                        LEFT JOIN accounts a ON a.id = c.account_id
                        ORDER BY c.amount DESC, a.name
                        """)
                .param("userId", userId)
                .param("from", from)
                .param("to", to)
                .query((rs, row) -> new ExpensesByConceptResponse.Concept(
                        rs.getObject("account_id", Long.class),
                        rs.getString("name"),
                        rs.getString("icon"),
                        rs.getString("color"),
                        rs.getBigDecimal("amount")))
                .list();
    }

    public List<MonthNet> monthlyNets(Long userId, int fromYear, int toYear) {
        return jdbc.sql("""
                        SELECT CAST(EXTRACT(YEAR FROM t.applied_at) AS int) AS year,
                               CAST(EXTRACT(MONTH FROM t.applied_at) AS int) AS month,
                               SUM(%s) - SUM(%s) AS net
                        FROM transactions t
                        WHERE t.user_id = :userId AND t.applied = TRUE
                          AND t.applied_at >= :from AND t.applied_at < :to
                        GROUP BY 1, 2
                        """.formatted(INCOME, EXPENSE))
                .param("userId", userId)
                .param("from", LocalDate.of(fromYear, 1, 1).atStartOfDay())
                .param("to", LocalDate.of(toYear + 1, 1, 1).atStartOfDay())
                .query((rs, row) -> new MonthNet(rs.getInt("year"), rs.getInt("month"), rs.getBigDecimal("net")))
                .list();
    }

    /** ACTIVE accounts of the tree (no SUPPLIER / CONSUMER); balance 0 when not included in the balance. */
    public List<AccountTree.Item> treeAccounts(Long userId) {
        return jdbc.sql("""
                        SELECT id, parent_account_id AS parent_id, name, type, icon, color,
                               CASE WHEN include_in_balance THEN COALESCE(balance, 0) ELSE 0 END AS balance
                        FROM accounts
                        WHERE user_id = :userId AND status = 'ACTIVE'
                          AND type NOT IN ('SUPPLIER', 'CONSUMER')
                        """)
                .param("userId", userId)
                .query((rs, row) -> new AccountTree.Item(
                        rs.getLong("id"),
                        rs.getObject("parent_id", Long.class),
                        rs.getString("name"),
                        AccountType.valueOf(rs.getString("type")),
                        rs.getString("icon"),
                        rs.getString("color"),
                        rs.getBigDecimal("balance")))
                .list();
    }
}
