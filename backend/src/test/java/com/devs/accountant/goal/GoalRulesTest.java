package com.devs.accountant.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devs.accountant.dashboard.DashboardRepository;
import com.devs.accountant.dashboard.DashboardService;
import com.devs.accountant.dashboard.dto.ProgressResponse;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** Goals: only registered years appear in the progress (last 3) and past years cannot be deleted. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoalRulesTest {

    private static final long USER = 1L;
    private static final ZoneId MX = ZoneId.of("America/Mexico_City");

    @Mock
    private GoalRepository goalRepository;

    @Mock
    private DashboardRepository dashboardRepository;

    @Mock
    private CurrentUser currentUser;

    private GoalServiceImpl goalService;
    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        Clock clock =
                Clock.fixed(LocalDateTime.of(2026, 11, 17, 10, 0).atZone(MX).toInstant(), MX);
        goalService = new GoalServiceImpl(goalRepository, currentUser, clock);
        dashboardService = new DashboardService(dashboardRepository, goalRepository, currentUser, clock);
        when(currentUser.id()).thenReturn(USER);
        when(dashboardRepository.monthlyNets(anyLong(), anyInt(), anyInt())).thenReturn(List.of());
    }

    @Test
    void progressShowsOnlyTheRegisteredYears() {
        when(goalRepository.findByUserIdOrderByYearDesc(USER)).thenReturn(List.of(goal(2026)));

        List<ProgressResponse> progress = dashboardService.progress(3);

        assertThat(progress).extracting(ProgressResponse::year).containsExactly(2026);
    }

    @Test
    void progressShowsTheThreeMostRecentRegisteredYears() {
        when(goalRepository.findByUserIdOrderByYearDesc(USER))
                .thenReturn(List.of(goal(2026), goal(2024), goal(2021), goal(2020)));

        List<ProgressResponse> progress = dashboardService.progress(3);

        assertThat(progress).extracting(ProgressResponse::year).containsExactly(2026, 2024, 2021);
        verify(dashboardRepository).monthlyNets(USER, 2021, 2026);
    }

    @Test
    void withoutGoalsThereIsNoProgress() {
        when(goalRepository.findByUserIdOrderByYearDesc(USER)).thenReturn(List.of());

        assertThat(dashboardService.progress(3)).isEmpty();
        verify(dashboardRepository, never()).monthlyNets(anyLong(), anyInt(), anyInt());
    }

    @Test
    void theGoalOfAPastYearCannotBeDeleted() {
        when(goalRepository.findByUserIdAndYear(USER, 2025)).thenReturn(Optional.of(goal(2025)));

        assertThatThrownBy(() -> goalService.delete(2025))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex ->
                        assertThat(((BusinessException) ex).getErrors()).containsEntry("year", "GOAL_YEAR_CLOSED"));
        verify(goalRepository, never()).delete(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void theGoalOfTheCurrentYearCanBeDeleted() {
        Goal current = goal(2026);
        when(goalRepository.findByUserIdAndYear(eq(USER), eq(2026))).thenReturn(Optional.of(current));

        goalService.delete(2026);

        verify(goalRepository).delete(current);
    }

    private static Goal goal(int year) {
        Goal goal = new Goal();
        goal.setUserId(USER);
        goal.setYear(year);
        goal.setTargetAmount(new BigDecimal("12000.00"));
        return goal;
    }
}
