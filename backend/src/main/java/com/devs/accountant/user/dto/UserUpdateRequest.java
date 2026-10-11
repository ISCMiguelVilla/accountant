package com.devs.accountant.user.dto;

import com.devs.accountant.user.UserStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Admin update of a user. The role is not editable: there is exactly one ADMIN, the first registered user. */
public record UserUpdateRequest(
        @NotBlank @Size(min = 2, max = 100) String name,
        @NotNull UserStatus status) {}
