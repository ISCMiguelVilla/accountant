package com.devs.accountant.shared.paging;

import com.devs.accountant.shared.exception.InvalidQueryException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Resolves {@link PageParams} controller arguments from the query string. */
public class PageParamsArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return PageParams.class.equals(parameter.getParameterType());
    }

    @Override
    public PageParams resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest request,
            WebDataBinderFactory binderFactory) {
        String[] sort = request.getParameterValues(PageParams.SORT);
        return new PageParams(
                integer(request, PageParams.PAGE),
                integer(request, PageParams.SIZE),
                sort == null ? List.of() : Arrays.asList(sort),
                Set.copyOf(request.getParameterMap().keySet()));
    }

    private static Integer integer(NativeWebRequest request, String name) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            throw new InvalidQueryException(name);
        }
    }
}
