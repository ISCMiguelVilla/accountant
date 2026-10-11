package com.devs.accountant.shared.paging;

import java.util.List;
import java.util.Set;

/**
 * Raw paging request of a listing endpoint: {@code page} (0-based), {@code size}, repeatable {@code sort=field,dir}
 * and the names of every query parameter received (used to reject filters that are not allowed).
 */
public record PageParams(Integer page, Integer size, List<String> sort, Set<String> parameterNames) {

    public static final String PAGE = "page";
    public static final String SIZE = "size";
    public static final String SORT = "sort";

    public PageParams {
        sort = sort == null ? List.of() : List.copyOf(sort);
        parameterNames = parameterNames == null ? Set.of() : Set.copyOf(parameterNames);
    }

    public static PageParams of(Integer page, Integer size, String... sort) {
        return new PageParams(page, size, List.of(sort), Set.of());
    }
}
