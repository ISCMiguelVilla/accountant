package com.devs.accountant.account;

import com.devs.accountant.account.dto.AccountDetailResponse;
import com.devs.accountant.account.dto.AccountFilter;
import com.devs.accountant.account.dto.AccountOption;
import com.devs.accountant.account.dto.AccountRef;
import com.devs.accountant.account.dto.AccountRequest;
import com.devs.accountant.account.dto.AccountResponse;
import com.devs.accountant.account.dto.AccountUpdateRequest;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @GetMapping
    public PageResponse<AccountResponse> findAll(@ModelAttribute AccountFilter filter, PageParams params) {
        return accountService.findAll(filter, params);
    }

    @GetMapping("/options")
    public List<AccountOption> options() {
        return accountService.options();
    }

    @GetMapping("/in-use")
    public List<AccountResponse> inUse() {
        return accountService.inUse();
    }

    @GetMapping("/parent-options")
    public List<AccountRef> parentOptions(
            @RequestParam AccountType type, @RequestParam(required = false) Long accountId) {
        return accountService.parentOptions(type, accountId);
    }

    @GetMapping("/{id}")
    public AccountDetailResponse findById(@PathVariable Long id) {
        return accountService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountDetailResponse create(@Valid @RequestBody AccountRequest request) {
        return accountService.create(request);
    }

    @PutMapping("/{id}")
    public AccountDetailResponse update(@PathVariable Long id, @Valid @RequestBody AccountUpdateRequest request) {
        return accountService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        accountService.delete(id);
    }
}
