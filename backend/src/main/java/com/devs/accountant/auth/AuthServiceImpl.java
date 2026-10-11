package com.devs.accountant.auth;

import com.devs.accountant.auth.dto.AuthResponse;
import com.devs.accountant.auth.dto.SignInRequest;
import com.devs.accountant.auth.dto.SignUpRequest;
import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.user.PreferredLanguage;
import com.devs.accountant.user.Role;
import com.devs.accountant.user.User;
import com.devs.accountant.user.UserMapper;
import com.devs.accountant.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class AuthServiceImpl implements AuthService {

    static final String USERNAME_TAKEN = "USERNAME_TAKEN";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserMapper userMapper;

    /** Checked against unknown usernames so they cost the same as a real check (no timing oracle). */
    private final String dummyHash;

    public AuthServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            UserMapper userMapper) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.userMapper = userMapper;
        this.dummyHash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse signIn(SignInRequest request) {
        User user = userRepository
                .findByUsernameIgnoreCase(request.username().trim())
                .orElse(null);
        String hash = user == null ? dummyHash : user.getPassword();
        boolean matches = passwordEncoder.matches(request.password(), hash);
        if (user == null || !matches || !user.isActive()) {
            log.debug("Failed sign-in attempt");
            throw new BusinessException(ErrorCode.BAD_CREDENTIALS, "Bad credentials");
        }
        return authenticated(user);
    }

    /**
     * Not transactional on purpose: each save runs in its own repository transaction, so if two first sign-ups race
     * for the ADMIN role, the one rejected by {@code ux_users_single_admin} can be retried as USER.
     */
    @Override
    public AuthResponse signUp(SignUpRequest request) {
        String username = request.username().trim();
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw BusinessException.fieldError("username", USERNAME_TAKEN);
        }
        Role role = userRepository.existsByRole(Role.ADMIN) ? Role.USER : Role.ADMIN;
        User user;
        try {
            user = userRepository.saveAndFlush(newUser(request, username, role));
        } catch (DataIntegrityViolationException ex) {
            if (role != Role.ADMIN || userRepository.existsByUsernameIgnoreCase(username)) {
                throw BusinessException.fieldError("username", USERNAME_TAKEN);
            }
            user = userRepository.saveAndFlush(newUser(request, username, Role.USER));
        }
        log.info("User {} registered with role {}", user.getId(), user.getRole());
        return authenticated(user);
    }

    private User newUser(SignUpRequest request, String username, Role role) {
        User user = new User();
        user.setName(request.name().trim());
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(role);
        user.setPreferredLanguage(
                request.preferredLanguage() == null ? PreferredLanguage.ES : request.preferredLanguage());
        return user;
    }

    private AuthResponse authenticated(User user) {
        JwtService.IssuedToken token = jwtService.issue(user);
        return new AuthResponse(token.token(), token.expiresAt(), userMapper.toResponse(user));
    }
}
