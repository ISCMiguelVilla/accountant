package com.devs.accountant.shared.paging;

import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.Arrays;
import java.util.Collection;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Reusable JPA {@link Specification} fragments. Every factory returns {@code null} (no restriction) when the filter
 * value is absent, so specifications can be chained with {@link #all}. Attributes may be dotted paths
 * ({@code parent.id}).
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
        return value == null ? null : (root, query, cb) -> cb.equal(path(root, attribute), value);
    }

    public static <T> Specification<T> notEqual(String attribute, Object value) {
        return value == null ? null : (root, query, cb) -> cb.notEqual(path(root, attribute), value);
    }

    public static <T> Specification<T> in(String attribute, Collection<?> values) {
        return values == null || values.isEmpty()
                ? null
                : (root, query, cb) -> path(root, attribute).in(values);
    }

    /** Case-insensitive "contains" over one or more attributes (OR). */
    public static <T> Specification<T> contains(String value, String... attributes) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String pattern = "%" + escapeLike(value.trim().toLowerCase(Locale.ROOT)) + "%";
        return (root, query, cb) -> cb.or(Arrays.stream(attributes)
                .map(attribute -> cb.like(cb.lower(path(root, attribute)), pattern, '\\'))
                .toArray(Predicate[]::new));
    }

    @SuppressWarnings("unchecked")
    public static <Y> Path<Y> path(Root<?> root, String attribute) {
        Path<?> path = root;
        for (String part : attribute.split("\\.")) {
            path = path.get(part);
        }
        return (Path<Y>) path;
    }

    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
