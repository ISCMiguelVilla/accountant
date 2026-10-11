package com.devs.accountant.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.security.CurrentUser;
import com.devs.accountant.user.dto.UserUpdateRequest;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CurrentUser currentUser;

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userRepository, new UserMapperImpl(), currentUser);
        when(currentUser.id()).thenReturn(1L);
    }

    @Test
    void adminCannotBeDisabled() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, Role.ADMIN)));

        assertThatThrownBy(() -> service.update(1L, new UserUpdateRequest("Ana", UserStatus.DISABLED)))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void adminCanBeRenamed() {
        User admin = user(1L, Role.ADMIN);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        var response = service.update(1L, new UserUpdateRequest(" Ana María ", UserStatus.ACTIVE));

        assertThat(response.name()).isEqualTo("Ana María");
        assertThat(response.role()).isEqualTo(Role.ADMIN);
    }

    @Test
    void regularUsersCanBeDisabledButKeepTheirRole() {
        User user = user(2L, Role.USER);
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));

        var response = service.update(2L, new UserUpdateRequest("Beto", UserStatus.DISABLED));

        assertThat(response.status()).isEqualTo(UserStatus.DISABLED);
        assertThat(response.role()).isEqualTo(Role.USER);
    }

    @Test
    void updatesThePreferredLanguageOfTheCurrentUser() {
        User me = user(1L, Role.USER);
        when(userRepository.findById(1L)).thenReturn(Optional.of(me));

        var response = service.updateLanguage(PreferredLanguage.EN);

        assertThat(response.preferredLanguage()).isEqualTo(PreferredLanguage.EN);
        assertThat(me.getPreferredLanguage()).isEqualTo(PreferredLanguage.EN);
    }

    @Test
    void unknownUserIsNotFound() {
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findById(9L)).isInstanceOf(ResourceNotFoundException.class);
    }

    private static User user(Long id, Role role) {
        User user = new User();
        user.setId(id);
        user.setName("Name");
        user.setUsername("user" + id);
        user.setRole(role);
        return user;
    }
}
