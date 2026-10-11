package com.devs.accountant.shared.paging;

import com.devs.accountant.shared.exception.InvalidQueryException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * White list of sortable and filterable fields of a listing resource. Turns {@link PageParams} into a
 * {@link Pageable}, rejecting (400) any sort field or query parameter that is not allowed.
 */
public final class QueryDefinition {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    /** API field name → entity property path. */
    private final Map<String, String> sortable;

    private final Set<String> filterable;
    private final Sort defaultSort;
    private final int defaultSize;

    private QueryDefinition(Builder builder) {
        this.sortable = Map.copyOf(builder.sortable);
        this.filterable = Set.copyOf(builder.filterable);
        this.defaultSort = builder.defaultSort;
        this.defaultSize = builder.defaultSize;
    }

    public static Builder builder() {
        return new Builder();
    }

    public Pageable toPageable(PageParams params) {
        validateParameters(params);
        int page = params.page() == null ? 0 : params.page();
        int size = params.size() == null ? defaultSize : params.size();
        if (page < 0) {
            throw new InvalidQueryException(PageParams.PAGE);
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new InvalidQueryException(PageParams.SIZE);
        }
        return PageRequest.of(page, size, toSort(params.sort()));
    }

    /** Maps an entity property back to its API name (used to echo the applied sort). */
    String apiField(String property) {
        return sortable.entrySet().stream()
                .filter(entry -> entry.getValue().equals(property))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(property);
    }

    private void validateParameters(PageParams params) {
        for (String name : params.parameterNames()) {
            boolean paging =
                    PageParams.PAGE.equals(name) || PageParams.SIZE.equals(name) || PageParams.SORT.equals(name);
            if (!paging && !filterable.contains(name)) {
                throw new InvalidQueryException(name);
            }
        }
    }

    private Sort toSort(List<String> values) {
        if (values.isEmpty()) {
            return defaultSort;
        }
        List<Sort.Order> orders = new ArrayList<>();
        for (String value : values) {
            String[] parts = value.split(",");
            String field = parts[0].trim();
            String property = sortable.get(field);
            if (property == null || parts.length > 2) {
                throw new InvalidQueryException(PageParams.SORT);
            }
            Sort.Direction direction = Sort.Direction.ASC;
            if (parts.length == 2) {
                direction = Sort.Direction.fromOptionalString(parts[1].trim())
                        .orElseThrow(() -> new InvalidQueryException(PageParams.SORT));
            }
            orders.add(new Sort.Order(direction, property));
        }
        return Sort.by(orders);
    }

    public static final class Builder {

        private final Map<String, String> sortable = new LinkedHashMap<>();
        private final Set<String> filterable = new HashSet<>();
        private Sort defaultSort = Sort.unsorted();
        private int defaultSize = DEFAULT_SIZE;

        /** Sortable field whose API name equals the entity property. */
        public Builder sortable(String... fields) {
            for (String field : fields) {
                sortable.put(field, field);
            }
            return this;
        }

        public Builder sortableAs(String apiField, String property) {
            sortable.put(apiField, property);
            return this;
        }

        public Builder filterable(String... names) {
            filterable.addAll(List.of(names));
            return this;
        }

        public Builder defaultSort(Sort sort) {
            this.defaultSort = sort;
            return this;
        }

        public Builder defaultSize(int size) {
            this.defaultSize = size;
            return this;
        }

        public QueryDefinition build() {
            return new QueryDefinition(this);
        }
    }
}
