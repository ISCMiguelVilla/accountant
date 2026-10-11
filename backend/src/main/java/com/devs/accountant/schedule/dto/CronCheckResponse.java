package com.devs.accountant.schedule.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CronCheckResponse(boolean valid, List<LocalDateTime> nextExecutions) {}
