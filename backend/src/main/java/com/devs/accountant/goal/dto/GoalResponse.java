package com.devs.accountant.goal.dto;

import java.math.BigDecimal;

public record GoalResponse(int year, BigDecimal targetAmount) {}
