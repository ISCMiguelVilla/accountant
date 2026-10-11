package com.devs.accountant.shared.paging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.devs.accountant.shared.exception.InvalidQueryException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class QueryDefinitionTest {

    private final QueryDefinition definition = QueryDefinition.builder()
            .sortable("name", "createdAt")
            .sortableAs("operationDate", "operation_date_property")
            .filterable("name", "status")
            .defaultSort(Sort.by("name"))
            .build();

    @Test
    void appliesDefaultsWhenNothingIsRequested() {
        Pageable pageable = definition.toPageable(PageParams.of(null, null));

        assertThat(pageable.getPageNumber()).isZero();
        assertThat(pageable.getPageSize()).isEqualTo(QueryDefinition.DEFAULT_SIZE);
        assertThat(pageable.getSort()).isEqualTo(Sort.by("name"));
    }

    @Test
    void mapsRepeatableSortsToEntityProperties() {
        Pageable pageable = definition.toPageable(PageParams.of(2, 50, "operationDate,desc", "name"));

        assertThat(pageable.getPageNumber()).isEqualTo(2);
        assertThat(pageable.getPageSize()).isEqualTo(50);
        assertThat(pageable.getSort())
                .containsExactly(Sort.Order.desc("operation_date_property"), Sort.Order.asc("name"));
    }

    @Test
    void rejectsSortFieldsOutsideTheWhiteList() {
        assertThatThrownBy(() -> definition.toPageable(PageParams.of(0, 10, "password,asc")))
                .isInstanceOf(InvalidQueryException.class)
                .satisfies(ex -> assertThat(((InvalidQueryException) ex).getErrors())
                        .containsEntry("sort", InvalidQueryException.CODE));
    }

    @Test
    void rejectsInvalidSortDirection() {
        assertThatThrownBy(() -> definition.toPageable(PageParams.of(0, 10, "name,sideways")))
                .isInstanceOf(InvalidQueryException.class);
    }

    @Test
    void rejectsSizesAboveTheMaximumAndNegativePages() {
        assertThatThrownBy(() -> definition.toPageable(PageParams.of(0, QueryDefinition.MAX_SIZE + 1)))
                .isInstanceOf(InvalidQueryException.class);
        assertThatThrownBy(() -> definition.toPageable(PageParams.of(-1, 10)))
                .isInstanceOf(InvalidQueryException.class);
    }

    @Test
    void rejectsFiltersThatAreNotAllowed() {
        PageParams params = new PageParams(0, 10, List.of(), Set.of("page", "name", "password"));

        assertThatThrownBy(() -> definition.toPageable(params))
                .isInstanceOf(InvalidQueryException.class)
                .satisfies(ex ->
                        assertThat(((InvalidQueryException) ex).getErrors()).containsKey("password"));
    }

    @Test
    void pageResponseEchoesSortWithApiFieldNames() {
        Pageable pageable = definition.toPageable(PageParams.of(0, 10, "operationDate,desc"));
        var page = new PageImpl<>(List.of("a", "b"), pageable, 12);

        PageResponse<String> response = PageResponse.of(page, String::toUpperCase, definition);

        assertThat(response.content()).containsExactly("A", "B");
        assertThat(response.totalElements()).isEqualTo(12);
        assertThat(response.totalPages()).isEqualTo(2);
        assertThat(response.sort()).containsExactly(new PageResponse.SortOrder("operationDate", "DESC"));
    }

    @Test
    void escapesLikeWildcards() {
        assertThat(Specs.escapeLike("50%_off\\")).isEqualTo("50\\%\\_off\\\\");
    }
}
