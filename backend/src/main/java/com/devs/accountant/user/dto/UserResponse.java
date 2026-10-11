package com.devs.accountant.user.dto;

import com.devs.accountant.user.PreferredLanguage;
import com.devs.accountant.user.Role;
import com.devs.accountant.user.UserStatus;
import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String name,
        String username,
        Role role,
        UserStatus status,
        PreferredLanguage preferredLanguage,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
