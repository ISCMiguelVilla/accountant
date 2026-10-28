package com.devs.accountant.schedule.dto;

import com.devs.accountant.schedule.ScheduleStatus;
import jakarta.validation.constraints.NotNull;

/** Activate / deactivate ({@code DELETED} goes through {@code DELETE /schedules/{id}}). */
public record ScheduleStatusRequest(@NotNull ScheduleStatus status) {}
