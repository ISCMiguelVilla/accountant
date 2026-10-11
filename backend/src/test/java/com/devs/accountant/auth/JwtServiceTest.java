package com.devs.accountant.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.devs.accountant.shared.config.AppProperties;
import com.devs.accountant.user.Role;
import com.devs.accountant.user.User;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "ZGV2LW9ubHktc2VjcmV0LWNoYW5nZS1tZS1hY2NvdW50YW50LWp3dC0yNTZiaXRz";
    private static final Instant NOW = Instant.parse("2026-10-10T12:00:00Z");

    @Test
    void issuedTokenResolvesToTheUserIdAndExpiresAfterTheConfiguredMinutes() {
        JwtService service = service(SECRET, Clock.fixed(NOW, ZoneId.of("UTC")));

        JwtService.IssuedToken token = service.issue(user());

        assertThat(token.expiresAt()).isEqualTo(NOW.plus(Duration.ofMinutes(240)));
        assertThat(service.parseUserId(token.token())).contains(7L);
    }

    @Test
    void expiredTokenIsRejected() {
        String token = service(SECRET, Clock.fixed(NOW, ZoneId.of("UTC")))
                .issue(user())
                .token();
        JwtService later = service(SECRET, Clock.fixed(NOW.plus(Duration.ofMinutes(241)), ZoneId.of("UTC")));

        assertThat(later.parseUserId(token)).isEmpty();
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        String token = service(SECRET, Clock.fixed(NOW, ZoneId.of("UTC")))
                .issue(user())
                .token();
        JwtService other = service("b3RoZXItc2VjcmV0LW90aGVyLXNlY3JldC1vdGhlci1zZWNyZXQtMTIzNA==", Clock.systemUTC());

        assertThat(other.parseUserId(token)).isEmpty();
        assertThat(other.parseUserId("not-a-jwt")).isEmpty();
    }

    @Test
    void secretsShorterThan256BitsAreRefused() {
        assertThatThrownBy(() -> service("c2hvcnQ=", Clock.systemUTC())).isInstanceOf(IllegalStateException.class);
    }

    private static JwtService service(String secret, Clock clock) {
        AppProperties properties = new AppProperties(
                "America/Mexico_City", new AppProperties.Jwt(secret, 240), new AppProperties.Cors(List.of()));
        return new JwtService(properties, clock);
    }

    private static User user() {
        User user = new User();
        user.setId(7L);
        user.setUsername("ana");
        user.setRole(Role.ADMIN);
        return user;
    }
}
