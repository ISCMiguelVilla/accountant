package com.devs.accountant.shared.paging;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/** Standard paged response shared by every listing endpoint. */
public record PageResponse<T>(
        List<T> content, int page, int size, long totalElements, int totalPages, List<SortOrder> sort) {

    public record SortOrder(String field, String direction) {}

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper, QueryDefinition definition) {
        List<SortOrder> sort = page.getSort().stream()
                .map(order -> new SortOrder(
                        definition.apiField(order.getProperty()),
                        order.getDirection().name()))
                .toList();
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                sort);
    }
}
