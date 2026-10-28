package com.devs.accountant.dashboard;

import com.devs.accountant.account.AccountType;
import com.devs.accountant.dashboard.dto.SummaryResponse.Node;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds the summary tree of the home (PROMPT 6.1): total = own balance + children totals, nodes with balance and
 * total 0 are removed, a node left with a single leaf child is collapsed into "parent › child", and each node gets its
 * share of the parent total.
 */
public final class AccountTree {

    static final String SEPARATOR = " › ";
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private AccountTree() {}

    /** Flat account; {@code balance} already 0 when it does not count (no balance, not included). */
    public record Item(
            Long id, Long parentId, String name, AccountType type, String icon, String color, BigDecimal balance) {}

    private record Built(
            Long id,
            String name,
            AccountType type,
            String icon,
            String color,
            BigDecimal balance,
            BigDecimal total,
            List<Built> children) {}

    public static List<Node> build(List<Item> items) {
        Set<Long> ids = items.stream().map(Item::id).collect(Collectors.toSet());
        Map<Long, List<Item>> byParent = new HashMap<>();
        List<Item> roots = new ArrayList<>();
        for (Item item : items) {
            if (item.parentId() == null || !ids.contains(item.parentId())) {
                roots.add(item);
            } else {
                byParent.computeIfAbsent(item.parentId(), key -> new ArrayList<>())
                        .add(item);
            }
        }
        List<Built> built = roots.stream()
                .map(root -> build(root, byParent))
                .filter(Objects::nonNull)
                .sorted(byTotal())
                .toList();
        BigDecimal total = built.stream().map(Built::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        return built.stream().map(node -> toNode(node, total)).toList();
    }

    public static BigDecimal total(List<Node> nodes) {
        return nodes.stream().map(Node::total).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static Built build(Item item, Map<Long, List<Item>> byParent) {
        List<Built> children = byParent.getOrDefault(item.id(), List.of()).stream()
                .map(child -> build(child, byParent))
                .filter(Objects::nonNull)
                .sorted(byTotal())
                .toList();
        BigDecimal balance = item.balance() == null ? BigDecimal.ZERO : item.balance();
        BigDecimal total = children.stream().map(Built::total).reduce(balance, BigDecimal::add);
        if (balance.signum() == 0 && total.signum() == 0) {
            return null;
        }
        if (children.size() == 1 && children.getFirst().children().isEmpty()) {
            Built leaf = children.getFirst();
            return new Built(
                    leaf.id(),
                    item.name() + SEPARATOR + leaf.name(),
                    leaf.type(),
                    leaf.icon(),
                    leaf.color(),
                    balance.add(leaf.balance()),
                    total,
                    List.of());
        }
        return new Built(item.id(), item.name(), item.type(), item.icon(), item.color(), balance, total, children);
    }

    private static Node toNode(Built node, BigDecimal parentTotal) {
        return new Node(
                node.id(),
                node.name(),
                node.type(),
                node.icon(),
                node.color(),
                node.balance(),
                node.total(),
                parentTotal.signum() == 0
                        ? BigDecimal.ZERO.setScale(2)
                        : node.total().multiply(HUNDRED).divide(parentTotal, 2, RoundingMode.HALF_UP),
                node.children().stream()
                        .map(child -> toNode(child, node.total()))
                        .toList());
    }

    private static Comparator<Built> byTotal() {
        return Comparator.comparing(Built::total).reversed().thenComparing(Built::name);
    }
}
