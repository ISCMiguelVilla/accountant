package com.devs.accountant.transaction;

import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.transaction.dto.BatchRequest;
import com.devs.accountant.transaction.dto.BatchResponse;
import com.devs.accountant.transaction.dto.TransactionFilter;
import com.devs.accountant.transaction.dto.TransactionResponse;
import com.devs.accountant.transaction.dto.TransactionRulesResponse;
import com.devs.accountant.transaction.engine.Side;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    @GetMapping("/transactions")
    public PageResponse<TransactionResponse> findAll(@ModelAttribute TransactionFilter filter, PageParams params) {
        return transactionService.findAll(filter, params);
    }

    @GetMapping("/transactions/rules")
    public TransactionRulesResponse rules() {
        return transactionService.rules();
    }

    @GetMapping("/transactions/{id}")
    public TransactionResponse findById(@PathVariable Long id) {
        return transactionService.findById(id);
    }

    @PostMapping("/transactions/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public BatchResponse saveBatch(@Valid @RequestBody BatchRequest request) {
        return transactionService.saveBatch(request);
    }

    /** {@code ?side=ORIGIN|DESTINATION} applies one side; without it, every pending side. */
    @PatchMapping("/transactions/{id}/apply")
    public TransactionResponse apply(@PathVariable Long id, @RequestParam(required = false) Side side) {
        return transactionService.apply(id, side);
    }

    @GetMapping("/accounts/{accountId}/transactions")
    public PageResponse<TransactionResponse> findByAccount(@PathVariable Long accountId, PageParams params) {
        return transactionService.findByAccount(accountId, params);
    }
}
