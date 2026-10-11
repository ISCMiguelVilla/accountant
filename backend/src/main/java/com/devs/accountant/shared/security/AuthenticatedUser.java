package com.devs.accountant.shared.security;

import com.devs.accountant.user.Role;

/** Principal stored in the security context for every authenticated request. */
public record AuthenticatedUser(Long id, String username, Role role) {

    public String authority() {
        return "ROLE_" + role.name();
    }
}
