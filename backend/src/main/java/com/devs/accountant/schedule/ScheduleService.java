package com.devs.accountant.schedule;

import com.devs.accountant.schedule.dto.ScheduleFilter;
import com.devs.accountant.schedule.dto.ScheduleRequest;
import com.devs.accountant.schedule.dto.ScheduleResponse;
import com.devs.accountant.schedule.dto.ScheduleStatusRequest;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import java.util.List;

public interface ScheduleService {

    PageResponse<ScheduleResponse> findAll(ScheduleFilter filter, PageParams params);

    /** ACTIVE schedules due up to the end of tomorrow, for the batch editor panel. */
    List<ScheduleResponse> applicable();

    ScheduleResponse findById(Long id);

    ScheduleResponse create(ScheduleRequest request);

    ScheduleResponse update(Long id, ScheduleRequest request);

    ScheduleResponse changeStatus(Long id, ScheduleStatusRequest request);

    /** Skips the next execution: {@code next_execution = cron.next(next_execution)}. */
    ScheduleResponse skip(Long id);

    /** Logical delete. */
    void delete(Long id);
}
