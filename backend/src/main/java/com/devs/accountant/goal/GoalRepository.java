package com.devs.accountant.goal;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<Goal, Long> {

    List<Goal> findByUserIdOrderByYearDesc(Long userId);

    List<Goal> findByUserIdAndYearBetween(Long userId, Integer from, Integer to);

    Optional<Goal> findByUserIdAndYear(Long userId, Integer year);
}
