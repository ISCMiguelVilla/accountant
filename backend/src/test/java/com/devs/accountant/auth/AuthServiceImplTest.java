package com.devs.accountant.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.devs.accountant.user.UserStatus;
import com.devs.accountant.user.dto.UserResponse;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private UserMapper userMapper;

    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode(anyString())).thenAnswer(invocation -> "hashed:" + invocation.getArgument(0));
        service = new AuthServiceImpl(userRepository, passwordEncoder, jwtService, userMapper);
    }

    @Test
    void firstUserBecomesAdmin() {
        when(userRepository.existsByUsernameIgnoreCase("ana")).thenReturn(false);
        when(userRepository.existsByRole(Role.ADMIN)).thenReturn(false);
        stubSaveAndToken();

        service.signUp(new SignUpRequest(" Ana ", " ana ", "password123", null));

        User saved = savedUser();
        assertThat(saved.getRole()).isEqualTo(Role.ADMIN);
        assertThat(saved.getName()).isEqualTo("Ana");
        assertThat(saved.getUsername()).isEqualTo("ana");
        assertThat(saved.getPassword()).isEqualTo("hashed:password123");
        assertThat(saved.getPreferredLanguage()).isEqualTo(PreferredLanguage.ES);
    }

    @Test
    void laterUsersAreRegularUsers() {
        when(userRepository.existsByUsernameIgnoreCase("beto")).thenReturn(false);
        when(userRepository.existsByRole(Role.ADMIN)).thenReturn(true);
        stubSaveAndToken();

        service.signUp(new SignUpRequest("Beto", "beto", "password123", PreferredLanguage.EN));

        assertThat(savedUser().getRole()).isEqualTo(Role.USER);
        assertThat(savedUser().getPreferredLanguage()).isEqualTo(PreferredLanguage.EN);
    }

    @Test
    void losingTheFirstAdminRaceRegistersAsUser() {
        when(userRepository.existsByUsernameIgnoreCase("beto")).thenReturn(false);
        when(userRepository.existsByRole(Role.ADMIN)).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class)))
                .thenThrow(new DataIntegrityViolationException("ux_users_single_admin"))
                .thenAnswer(invocation -> withId(invocation.getArgument(0)));
        when(jwtService.issue(any())).thenReturn(new JwtService.IssuedToken("t", Instant.EPOCH));

        service.signUp(new SignUpRequest("Beto", "beto", "password123", null));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, times(2)).saveAndFlush(captor.capture());
        assertThat(captor.getAllValues()).extracting(User::getRole).containsExactly(Role.ADMIN, Role.USER);
    }

    @Test
    void duplicatedUsernameIsAFieldError() {
        when(userRepository.existsByUsernameIgnoreCase("ana")).thenReturn(true);

        assertThatThrownBy(() -> service.signUp(new SignUpRequest("Ana", "ana", "password123", null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(business.getErrors()).containsEntry("username", AuthServiceImpl.USERNAME_TAKEN);
                });
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void signInReturnsTokenForValidCredentials() {
        User user = existingUser(UserStatus.ACTIVE);
        when(userRepository.findByUsernameIgnoreCase("ana")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "stored-hash")).thenReturn(true);
        when(jwtService.issue(user)).thenReturn(new JwtService.IssuedToken("token", Instant.EPOCH));
        when(userMapper.toResponse(user)).thenReturn(response(user));

        AuthResponse response = service.signIn(new SignInRequest("ana", "password123"));

        assertThat(response.token()).isEqualTo("token");
        assertThat(response.user().username()).isEqualTo("ana");
    }

    @Test
    void wrongPasswordUnknownUserAndDisabledUserAreBadCredentials() {
        User active = existingUser(UserStatus.ACTIVE);
        User disabled = existingUser(UserStatus.DISABLED);
        when(userRepository.findByUsernameIgnoreCase("ana")).thenReturn(Optional.of(active));
        when(userRepository.findByUsernameIgnoreCase("ghost")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("off")).thenReturn(Optional.of(disabled));
        when(passwordEncoder.matches("wrong", "stored-hash")).thenReturn(false);
        when(passwordEncoder.matches("password123", "stored-hash")).thenReturn(true);
        // Unknown users are still checked, against a dummy hash, to keep a constant cost.
        lenient()
                .when(passwordEncoder.matches(eq("password123"), startsWith("hashed:")))
                .thenReturn(false);

        assertBadCredentials(new SignInRequest("ana", "wrong"));
        assertBadCredentials(new SignInRequest("ghost", "password123"));
        assertBadCredentials(new SignInRequest("off", "password123"));
        verify(jwtService, never()).issue(any());
    }

    private void assertBadCredentials(SignInRequest request) {
        assertThatThrownBy(() -> service.signIn(request))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.BAD_CREDENTIALS);
    }

    private void stubSaveAndToken() {
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> withId(invocation.getArgument(0)));
        when(jwtService.issue(any())).thenReturn(new JwtService.IssuedToken("t", Instant.EPOCH));
    }

    private User savedUser() {
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    private static User withId(User user) {
        user.setId(1L);
        return user;
    }

    private static User existingUser(UserStatus status) {
        User user = new User();
        user.setId(1L);
        user.setUsername("ana");
        user.setPassword("stored-hash");
        user.setRole(Role.USER);
        user.setStatus(status);
        return user;
    }

    private static UserResponse response(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getRole(),
                user.getStatus(),
                user.getPreferredLanguage(),
                null,
                null);
    }
}
