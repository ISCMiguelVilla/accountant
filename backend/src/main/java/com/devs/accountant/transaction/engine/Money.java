package com.devs.accountant.transaction.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Money is always 2 decimals, rounded half up. */
public final class Money {

    private Money() {}

    public static BigDecimal of(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal of(String value) {
        return of(new BigDecimal(value));
    }

    public static BigDecimal zero() {
        return of(BigDecimal.ZERO);
    }
}
