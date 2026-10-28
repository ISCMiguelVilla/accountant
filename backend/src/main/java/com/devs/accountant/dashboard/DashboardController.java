package com.devs.accountant.dashboard;

import com.devs.accountant.dashboard.dto.ExpensesByConceptResponse;
import com.devs.accountant.dashboard.dto.IncomeStatementResponse;
import com.devs.accountant.dashboard.dto.ProgressResponse;
import com.devs.accountant.dashboard.dto.SummaryResponse;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /** Window of {@code size} periods centered on {@code reference} (default today); size clamped to its bounds. */
    @GetMapping("/income-statement")
    public IncomeStatementResponse incomeStatement(
            @RequestParam(required = false) Dimension dimension,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate reference) {
        return dashboardService.incomeStatement(dimension, size, reference);
    }

    @GetMapping("/expenses-by-concept")
    public ExpensesByConceptResponse expensesByConcept(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return dashboardService.expensesByConcept(month);
    }

    @GetMapping("/summary")
    public SummaryResponse summary() {
        return dashboardService.summary();
    }

    @GetMapping("/progress")
    public List<ProgressResponse> progress(@RequestParam(required = false) Integer years) {
        return dashboardService.progress(years);
    }
}
