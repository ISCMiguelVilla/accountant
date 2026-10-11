package com.devs.accountant.credit.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Credit line of a DEBTOR account; crons are Spring 6-field expressions (e.g. {@code 0 0 0 15 * *}). */
public record CreditRequest(
        @NotNull @Positive @Digits(integer = 17, fraction = 2)
        BigDecimal creditLimit,

        @NotBlank @Size(max = 100) String cutOffCron,
        @NotBlank @Size(max = 100) String paymentDueCron) {}
