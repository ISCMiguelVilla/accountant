package com.devs.accountant.credit;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps {@code cut_off_day} / {@code payment_due_day} pointing at the next occurrence: daily at 00:05 Mexico City
 * time and once on startup (in case the container was down at midnight).
 */
@Component
@RequiredArgsConstructor
public class CreditDateJob {

    private final CreditService creditService;

    @Scheduled(cron = "0 5 0 * * *", zone = "America/Mexico_City")
    public void daily() {
        creditService.refreshDates();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        creditService.refreshDates();
    }
}
