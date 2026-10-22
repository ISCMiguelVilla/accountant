package com.devs.accountant.account.dto;

import com.devs.accountant.account.AccountStatus;
import com.devs.accountant.account.AccountType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;

/**
 * Update of an account: only the properties present in the JSON body are changed; absent properties keep their
 * stored value (the id never changes). An explicit {@code null} clears {@code parentId}, {@code icon} or
 * {@code color}. Jackson only calls a setter when the property is present, which is how presence is tracked.
 */
@Getter
public class AccountUpdateRequest {

    @JsonIgnore
    private final Set<String> present = new HashSet<>();

    @Size(max = 100)
    @Pattern(regexp = ".*\\S.*")
    private String name;

    private AccountType type;
    private Long parentId;
    private Long currencyId;

    @PositiveOrZero
    @Digits(integer = 17, fraction = 2)
    private BigDecimal balance;

    @Pattern(regexp = "^pi pi-[a-z0-9-]+$")
    private String icon;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
    private String color;

    private Boolean includeInBalance;
    private Boolean temporary;
    private AccountStatus status;
    /** Optimistic check: when sent it must match the stored version. */
    private Long version;

    public boolean has(String property) {
        return present.contains(property);
    }

    public void setName(String name) {
        this.name = name;
        present.add("name");
    }

    public void setType(AccountType type) {
        this.type = type;
        present.add("type");
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
        present.add("parentId");
    }

    public void setCurrencyId(Long currencyId) {
        this.currencyId = currencyId;
        present.add("currencyId");
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
        present.add("balance");
    }

    public void setIcon(String icon) {
        this.icon = icon;
        present.add("icon");
    }

    public void setColor(String color) {
        this.color = color;
        present.add("color");
    }

    public void setIncludeInBalance(Boolean includeInBalance) {
        this.includeInBalance = includeInBalance;
        present.add("includeInBalance");
    }

    public void setTemporary(Boolean temporary) {
        this.temporary = temporary;
        present.add("temporary");
    }

    public void setStatus(AccountStatus status) {
        this.status = status;
        present.add("status");
    }

    public void setVersion(Long version) {
        this.version = version;
        present.add("version");
    }
}
