package com.devs.accountant.goal;

import com.devs.accountant.goal.dto.GoalRequest;
import com.devs.accountant.goal.dto.GoalResponse;
import java.util.List;

public interface GoalService {

    List<GoalResponse> findAll();

    /** Creates or replaces the goal of the year. */
    GoalResponse save(int year, GoalRequest request);

    void delete(int year);
}
