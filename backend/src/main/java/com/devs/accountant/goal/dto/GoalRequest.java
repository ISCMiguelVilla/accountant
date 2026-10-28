package com.devs.accountant.goal.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record GoalRequest(
        @NotNull @Positive @Digits(integer = 17, fraction = 2)
        BigDecimal targetAmount) {}
