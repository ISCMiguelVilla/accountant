package com.devs.accountant.credit;

import com.devs.accountant.credit.dto.CreditRequest;
import com.devs.accountant.credit.dto.CreditResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/accounts/{accountId}/credit")
@RequiredArgsConstructor
public class CreditController {

    private final CreditService creditService;

    @PutMapping
    public CreditResponse upsert(@PathVariable Long accountId, @Valid @RequestBody CreditRequest request) {
        return creditService.upsert(accountId, request);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long accountId) {
        creditService.delete(accountId);
    }
}
