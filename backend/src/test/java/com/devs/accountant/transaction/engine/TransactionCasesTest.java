package com.devs.accountant.transaction.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.devs.accountant.transaction.TransactionType;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Runs every case of {@code docs/transaction-cases.json}, shared with the TypeScript engine. */
class TransactionCasesTest {

    private static final Path CASES = Path.of("..", "docs", "transaction-cases.json");
    private static final String DEFAULT_DATE = "2026-10-01T12:00:00";

    static Stream<Named<JsonNode>> cases() throws IOException {
        JsonNode root = JsonMapper.builder().build().readTree(Files.readString(CASES));
        List<Named<JsonNode>> cases = new ArrayList<>();
        root.get("cases").forEach(node -> cases.add(Named.of(node.get("name").asString(), node)));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void engineMatchesTheSharedCase(JsonNode testCase) {
        List<EngineAccount> accounts = new ArrayList<>();
        testCase.get("accounts").forEach(node -> accounts.add(account(node)));
        List<EngineTransaction> transactions = new ArrayList<>();
        JsonNode txs = testCase.get("transactions");
        for (int i = 0; i < txs.size(); i++) {
            transactions.add(transaction(txs.get(i), i));
        }

        if (testCase.has("error")) {
            JsonNode error = testCase.get("error");
            assertThatThrownBy(() -> TransactionEngine.project(accounts, transactions))
                    .isInstanceOf(EngineException.class)
                    .satisfies(ex -> {
                        EngineException engine = (EngineException) ex;
                        assertThat(engine.getError().name())
                                .isEqualTo(error.get("code").asString());
                        assertThat(engine.getTransactionUuid())
                                .isEqualTo(error.get("transactionUuid").asString());
                        if (error.has("field")) {
                            assertThat(engine.getField())
                                    .isEqualTo(error.get("field").asString());
                            assertThat(engine.getFieldCode())
                                    .isEqualTo(error.get("fieldCode").asString());
                        }
                    });
            return;
        }

        TransactionEngine.BatchResult result = TransactionEngine.project(accounts, transactions);
        JsonNode expected = testCase.get("expected");

        expected.get("accounts").forEach(node -> {
            EngineAccount account = result.accounts().get(node.get("id").asLong());
            assertThat(text(account.balance()))
                    .as("balance of %s", node.get("id"))
                    .isEqualTo(text(node, "balance"));
            assertThat(account.status().name()).isEqualTo(node.get("status").asString());
        });

        Map<String, EngineResult> byUuid = result.results().stream()
                .collect(Collectors.toMap(r -> r.transaction().uuid(), Function.identity()));
        List<String> order =
                result.results().stream().map(r -> r.transaction().uuid()).toList();
        List<String> expectedOrder = new ArrayList<>();
        expected.get("transactions").forEach(node -> {
            String uuid = node.get("uuid").asString();
            expectedOrder.add(uuid);
            EngineResult r = byUuid.get(uuid);
            assertThat(r.operationType().name())
                    .as("operationType of %s", uuid)
                    .isEqualTo(node.get("operationType").asString());
            assertThat(text(r.originBalanceBefore()))
                    .as("originBalanceBefore of %s", uuid)
                    .isEqualTo(text(node, "originBalanceBefore"));
            assertThat(text(r.originBalanceAfter()))
                    .as("originBalanceAfter of %s", uuid)
                    .isEqualTo(text(node, "originBalanceAfter"));
            assertThat(text(r.destinationBalanceBefore()))
                    .as("destinationBalanceBefore of %s", uuid)
                    .isEqualTo(text(node, "destinationBalanceBefore"));
            assertThat(text(r.destinationBalanceAfter()))
                    .as("destinationBalanceAfter of %s", uuid)
                    .isEqualTo(text(node, "destinationBalanceAfter"));
        });
        // Expected transactions are listed in application (date) order.
        assertThat(order.stream().filter(expectedOrder::contains).toList()).isEqualTo(expectedOrder);

        if (expected.has("report")) {
            JsonNode report = expected.get("report");
            ReportAmounts amounts = result.reportAmounts();
            assertThat(text(amounts.income())).as("report income").isEqualTo(text(report, "income"));
            assertThat(text(amounts.expense())).as("report expense").isEqualTo(text(report, "expense"));
            assertThat(text(amounts.net())).as("report net").isEqualTo(text(report, "net"));
        }
    }

    private static EngineAccount account(JsonNode node) {
        return new EngineAccount(
                node.get("id").asLong(),
                AccountType.valueOf(node.get("type").asString()),
                node.has("status") ? AccountStatus.valueOf(node.get("status").asString()) : AccountStatus.ACTIVE,
                decimal(node, "balance"),
                decimal(node, "creditLimit"),
                node.has("temporary") && node.get("temporary").asBoolean());
    }

    private static EngineTransaction transaction(JsonNode node, int index) {
        return new EngineTransaction(
                node.get("uuid").asString(),
                index,
                TransactionType.valueOf(node.get("type").asString()),
                node.get("origin").asLong(),
                node.has("destination") ? node.get("destination").asLong() : null,
                decimal(node, "amount"),
                decimal(node, "fee"),
                flag(node, "applied"),
                LocalDateTime.parse(
                        node.has("operationDate") ? node.get("operationDate").asString() : DEFAULT_DATE));
    }

    /** Applied flags default to true. */
    private static boolean flag(JsonNode node, String field) {
        return !node.has(field) || node.get(field).asBoolean();
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull()
                ? new BigDecimal(node.get(field).asString())
                : null;
    }

    private static String text(JsonNode node, String field) {
        return node.get(field).isNull() ? null : node.get(field).asString();
    }

    private static String text(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }
}
