package com.devs.accountant.currency;

import com.devs.accountant.currency.dto.CurrencyOption;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/currencies")
@RequiredArgsConstructor
public class CurrencyController {

    private final CurrencyService currencyService;

    @GetMapping("/options")
    public List<CurrencyOption> options() {
        return currencyService.options();
    }
}
