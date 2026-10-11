package com.devs.accountant.auth;

import com.devs.accountant.shared.config.AppProperties;
import com.devs.accountant.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/** Issues and validates HS256 JWTs. The subject is the user id. */
@Service
public class JwtService {

    static final int MIN_SECRET_BYTES = 32;
    private static final String USERNAME_CLAIM = "username";
    private static final String ROLE_CLAIM = "role";

    private final SecretKey key;
    private final Duration expiration;
    private final Clock clock;

    public JwtService(AppProperties properties, Clock clock) {
        this.key = Keys.hmacShaKeyFor(secretBytes(properties.jwt().secret()));
        this.expiration = Duration.ofMinutes(properties.jwt().expirationMinutes());
        this.clock = clock;
    }

    public IssuedToken issue(User user) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(expiration);
        String token = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(USERNAME_CLAIM, user.getUsername())
                .claim(ROLE_CLAIM, user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        return new IssuedToken(token, expiresAt);
    }

    /** Returns the user id of a valid, unexpired token. */
    public Optional<Long> parseUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(Long.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    /** Accepts a base64 secret (recommended) or, as a fallback, the raw text; at least 256 bits either way. */
    static byte[] secretBytes(String secret) {
        byte[] bytes;
        try {
            bytes = Decoders.BASE64.decode(secret);
        } catch (RuntimeException ex) {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        if (bytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET must be at least 256 bits");
        }
        return bytes;
    }

    public record IssuedToken(String token, Instant expiresAt) {}
}
