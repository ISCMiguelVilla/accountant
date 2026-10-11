package com.devs.accountant.auth.dto;

import com.devs.accountant.user.PreferredLanguage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** {@code preferredLanguage} is optional; it defaults to Spanish. */
public record SignUpRequest(
        @NotBlank @Size(min = 2, max = 100) String name,

        @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[A-Za-z0-9._-]+$")
        String username,

        @NotBlank @Size(min = 8, max = 72) String password,
        PreferredLanguage preferredLanguage) {}
