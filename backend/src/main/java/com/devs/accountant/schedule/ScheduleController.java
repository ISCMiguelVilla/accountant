package com.devs.accountant.schedule;

import com.devs.accountant.schedule.dto.ScheduleFilter;
import com.devs.accountant.schedule.dto.ScheduleRequest;
import com.devs.accountant.schedule.dto.ScheduleResponse;
import com.devs.accountant.schedule.dto.ScheduleStatusRequest;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping
    public PageResponse<ScheduleResponse> findAll(@ModelAttribute ScheduleFilter filter, PageParams params) {
        return scheduleService.findAll(filter, params);
    }

    @GetMapping("/applicable")
    public List<ScheduleResponse> applicable() {
        return scheduleService.applicable();
    }

    @GetMapping("/{id}")
    public ScheduleResponse findById(@PathVariable Long id) {
        return scheduleService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleResponse create(@Valid @RequestBody ScheduleRequest request) {
        return scheduleService.create(request);
    }

    @PutMapping("/{id}")
    public ScheduleResponse update(@PathVariable Long id, @Valid @RequestBody ScheduleRequest request) {
        return scheduleService.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public ScheduleResponse changeStatus(@PathVariable Long id, @Valid @RequestBody ScheduleStatusRequest request) {
        return scheduleService.changeStatus(id, request);
    }

    @PatchMapping("/{id}/skip")
    public ScheduleResponse skip(@PathVariable Long id) {
        return scheduleService.skip(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        scheduleService.delete(id);
    }
}
