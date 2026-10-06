package com.devs.accountant.shared.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Exposes a {@link Clock} in the application time zone so services never call {@code now()} directly. */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock(AppProperties properties) {
        return Clock.system(ZoneId.of(properties.timeZone()));
    }
}
