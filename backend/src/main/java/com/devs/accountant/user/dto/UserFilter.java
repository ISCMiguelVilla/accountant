package com.devs.accountant.user.dto;

import com.devs.accountant.user.Role;
import com.devs.accountant.user.UserStatus;
import java.util.List;

/** Filters of {@code GET /admin/users}; {@code name} matches name or username. */
public record UserFilter(String name, List<UserStatus> status, List<Role> role) {}
