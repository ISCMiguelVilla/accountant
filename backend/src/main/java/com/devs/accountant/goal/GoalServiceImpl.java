package com.devs.accountant.goal;

import com.devs.accountant.goal.dto.GoalRequest;
import com.devs.accountant.goal.dto.GoalResponse;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.security.CurrentUser;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GoalServiceImpl implements GoalService {

    static final String INVALID_YEAR = "INVALID_YEAR";
    static final String GOAL_YEAR_CLOSED = "GOAL_YEAR_CLOSED";
    private static final int MIN_YEAR = 2000;
    private static final int MAX_YEAR = 2100;

    private final GoalRepository goalRepository;
    private final CurrentUser currentUser;
    private final Clock clock;

    @Override
    @Transactional(readOnly = true)
    public List<GoalResponse> findAll() {
        return goalRepository.findByUserIdOrderByYearDesc(currentUser.id()).stream()
                .map(GoalServiceImpl::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public GoalResponse save(int year, GoalRequest request) {
        if (year < MIN_YEAR || year > MAX_YEAR) {
            throw BusinessException.fieldError("year", INVALID_YEAR);
        }
        Long userId = currentUser.id();
        Goal goal = goalRepository.findByUserIdAndYear(userId, year).orElseGet(() -> {
            Goal created = new Goal();
            created.setUserId(userId);
            created.setYear(year);
            return created;
        });
        goal.setTargetAmount(request.targetAmount());
        return toResponse(goalRepository.save(goal));
    }

    @Override
    @Transactional
    public void delete(int year) {
        // The goal of a year that already ended is part of the history: it cannot be deleted.
        if (year < LocalDate.now(clock).getYear()) {
            throw BusinessException.fieldError("year", GOAL_YEAR_CLOSED);
        }
        Goal goal = goalRepository
                .findByUserIdAndYear(currentUser.id(), year)
                .orElseThrow(() -> new ResourceNotFoundException("Goal", (long) year));
        goalRepository.delete(goal);
    }

    private static GoalResponse toResponse(Goal goal) {
        return new GoalResponse(goal.getYear(), goal.getTargetAmount());
    }
}
