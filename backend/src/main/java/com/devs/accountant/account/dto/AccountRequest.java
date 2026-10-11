package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Create/update of an account. {@code balance} is overwritten as is (manual edit, no transaction) and ignored for
 * types without balance. {@code pendingExpense} only applies to DEBTOR (default: the balance). {@code version}, when
 * sent on update, must match the stored one (stale form → CONFLICT).
 */
public record AccountRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull AccountType type,
        Long parentId,
        @NotNull Long currencyId,
        @PositiveOrZero @Digits(integer = 17, fraction = 2) BigDecimal balance,
        @PositiveOrZero @Digits(integer = 17, fraction = 2) BigDecimal pendingExpense,
        @Pattern(regexp = "^pi pi-[a-z0-9-]+$") String icon,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
        Boolean includeInBalance,
        Boolean temporary,
        AccountStatus status,
        Long version) {}
