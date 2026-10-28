package com.devs.accountant.schedule;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ScheduleRepository extends JpaRepository<Schedule, Long>, JpaSpecificationExecutor<Schedule> {

    List<Schedule> findByUserIdAndIdInAndStatusNot(Long userId, Collection<Long> ids, ScheduleStatus excluded);

    Optional<Schedule> findByIdAndUserId(Long id, Long userId);

    @EntityGraph(attributePaths = {"origin", "origin.currency", "destination"})
    List<Schedule> findByUserIdAndStatusAndNextExecutionBeforeOrderByNextExecutionAscIdAsc(
            Long userId, ScheduleStatus status, LocalDateTime limit);
}
