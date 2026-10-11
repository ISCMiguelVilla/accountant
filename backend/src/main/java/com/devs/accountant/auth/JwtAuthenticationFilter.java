package com.devs.accountant.auth;

import com.devs.accountant.shared.security.AuthenticatedUser;
import com.devs.accountant.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates requests carrying {@code Authorization: Bearer <jwt>}. The user is reloaded on every request so a
 * disabled user loses access immediately. Invalid tokens leave the request anonymous (→ 401 when required).
 * Registered only inside the security filter chain (see {@code SecurityConfig}), not as a servlet filter.
 */
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)) {
            jwtService
                    .parseUserId(header.substring(BEARER.length()).trim())
                    .flatMap(userRepository::findById)
                    .filter(user -> user.isActive())
                    .ifPresent(user -> {
                        var principal = new AuthenticatedUser(user.getId(), user.getUsername(), user.getRole());
                        var authentication = new UsernamePasswordAuthenticationToken(
                                principal, null, List.of(new SimpleGrantedAuthority(principal.authority())));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    });
        }
        chain.doFilter(request, response);
    }
}
