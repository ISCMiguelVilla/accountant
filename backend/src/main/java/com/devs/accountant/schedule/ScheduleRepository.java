package com.devs.accountant.schedule;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ScheduleRepository extends JpaRepository<Schedule, Long>, JpaSpecificationExecutor<Schedule> {

    List<Schedule> findByUserIdAndIdInAndStatusNot(Long userId, Collection<Long> ids, ScheduleStatus excluded);
}
