package com.devs.accountant.schedule;

import com.devs.accountant.schedule.dto.CronCheckResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/schedules/cron")
@RequiredArgsConstructor
public class CronController {

    private final CronService cronService;

    @GetMapping("/check")
    public CronCheckResponse check(@RequestParam String expression, @RequestParam(defaultValue = "3") int count) {
        return cronService.check(expression, count);
    }
}
