package com.devs.accountant.shared.paging;

import java.util.Collection;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Reusable JPA {@link Specification} fragments. Every factory returns {@code null} (no restriction) when the filter
 * value is absent, so specifications can be chained with {@link #all}.
 */
public final class Specs {

    private Specs() {}

    @SafeVarargs
    public static <T> Specification<T> all(Specification<T>... specs) {
        Specification<T> result = (root, query, cb) -> cb.conjunction();
        for (Specification<T> spec : specs) {
            if (spec != null) {
                result = result.and(spec);
            }
        }
        return result;
    }

    public static <T> Specification<T> equal(String attribute, Object value) {
        return value == null ? null : (root, query, cb) -> cb.equal(root.get(attribute), value);
    }

    public static <T> Specification<T> in(String attribute, Collection<?> values) {
        return values == null || values.isEmpty()
                ? null
                : (root, query, cb) -> root.get(attribute).in(values);
    }

    /** Case-insensitive "contains" over one or more attributes (OR). */
    public static <T> Specification<T> contains(String value, String... attributes) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String pattern = "%" + escapeLike(value.trim().toLowerCase(Locale.ROOT)) + "%";
        return (root, query, cb) -> cb.or(java.util.Arrays.stream(attributes)
                .map(attribute -> cb.like(cb.lower(root.get(attribute)), pattern, '\\'))
                .toArray(jakarta.persistence.criteria.Predicate[]::new));
    }

    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
