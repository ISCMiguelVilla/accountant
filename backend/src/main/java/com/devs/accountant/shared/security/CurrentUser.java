package com.devs.accountant.shared.security;

import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** Single access point to the authenticated user; services never touch {@link SecurityContextHolder}. */
@Component
public class CurrentUser {

    public AuthenticatedUser get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        throw new AuthenticationCredentialsNotFoundException("No authenticated user");
    }

    public Long id() {
        return get().id();
    }
}
