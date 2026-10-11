package com.devs.accountant.auth.dto;

import com.devs.accountant.user.dto.UserResponse;
import java.time.Instant;

public record AuthResponse(String token, Instant expiresAt, UserResponse user) {}
