package com.devs.accountant.user.dto;

import com.devs.accountant.user.PreferredLanguage;
import jakarta.validation.constraints.NotNull;

public record LanguageRequest(@NotNull PreferredLanguage language) {}
