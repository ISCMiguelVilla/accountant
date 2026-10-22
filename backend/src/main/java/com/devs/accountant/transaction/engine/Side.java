package com.devs.accountant.transaction.engine;

/** Side of a transaction whose amount may still be waiting to be reflected. */
public enum Side {
    ORIGIN,
    DESTINATION
}
