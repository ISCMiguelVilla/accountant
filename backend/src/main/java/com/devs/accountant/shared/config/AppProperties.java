package com.devs.accountant.shared.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Application specific configuration, bound from the {@code app.*} properties. */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @NotBlank String timeZone,
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Cors cors) {

    public record Jwt(@NotBlank String secret, @Min(1) long expirationMinutes) {}

    public record Cors(List<String> allowedOrigins) {

        public Cors {
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }
}
