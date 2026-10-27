-- =====================================================================
-- Accountant — initial schema
-- Conventions: plural snake_case tables, BIGINT identity PKs,
-- enums as VARCHAR + CHECK, money as NUMERIC(19,2),
-- timestamps stored in America/Mexico_City local time.
-- =====================================================================

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    username           VARCHAR(50)  NOT NULL,
    password           VARCHAR(100) NOT NULL,
    role               VARCHAR(10)  NOT NULL,
    status             VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    preferred_language VARCHAR(2)   NOT NULL DEFAULT 'es',
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_users_username UNIQUE (username),
    CONSTRAINT ck_users_role CHECK (role IN ('ADMIN', 'USER')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'DISABLED')),
    CONSTRAINT ck_users_preferred_language CHECK (preferred_language IN ('es', 'en'))
);

-- Only one ADMIN may ever exist (avoids race conditions on first sign-up).
CREATE UNIQUE INDEX ux_users_single_admin ON users (role) WHERE role = 'ADMIN';

-- ---------------------------------------------------------------------
-- currencies (global catalog, managed by ADMIN)
-- ---------------------------------------------------------------------
CREATE TABLE currencies (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(50) NOT NULL,
    iso        VARCHAR(3)  NOT NULL,
    symbol     VARCHAR(5)  NOT NULL,
    status     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_currencies_name UNIQUE (name),
    CONSTRAINT ux_currencies_iso UNIQUE (iso),
    CONSTRAINT ck_currencies_iso CHECK (iso ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_currencies_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

-- ---------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT        NOT NULL REFERENCES users (id),
    currency_id        BIGINT        NOT NULL REFERENCES currencies (id),
    parent_account_id  BIGINT        REFERENCES accounts (id),
    name               VARCHAR(100)  NOT NULL,
    type               VARCHAR(20)   NOT NULL,
    balance            NUMERIC(19, 2),
    icon              VARCHAR(50),
    color              VARCHAR(7),
    include_in_balance BOOLEAN       NOT NULL DEFAULT TRUE,
    is_temporary       BOOLEAN       NOT NULL DEFAULT FALSE,
    status             VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    version            BIGINT        NOT NULL DEFAULT 0,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_accounts_type CHECK (type IN
        ('GROUP', 'SUPPLIER', 'STORAGE', 'CONSUMER', 'BUSINESS', 'INVESTMENT', 'CREDITOR', 'DEBTOR')),
    CONSTRAINT ck_accounts_status CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED')),
    CONSTRAINT ck_accounts_balance_non_negative CHECK (balance IS NULL OR balance >= 0),
    -- GROUP, SUPPLIER and CONSUMER never hold a balance; the rest always do.
    CONSTRAINT ck_accounts_balance_by_type CHECK (
        (type IN ('GROUP', 'SUPPLIER', 'CONSUMER') AND balance IS NULL)
        OR (type NOT IN ('GROUP', 'SUPPLIER', 'CONSUMER') AND balance IS NOT NULL)),
    CONSTRAINT ck_accounts_temporary CHECK (is_temporary = FALSE OR type IN ('INVESTMENT', 'BUSINESS')),
    CONSTRAINT ck_accounts_color CHECK (color IS NULL OR color ~ '^#[0-9A-F]{6}$'),
    CONSTRAINT ck_accounts_not_own_parent CHECK (parent_account_id IS NULL OR parent_account_id <> id)
);

-- Name unique per (user, name, type) among non-deleted accounts.
CREATE UNIQUE INDEX ux_accounts_user_name_type ON accounts (user_id, name, type) WHERE status <> 'DELETED';
CREATE INDEX ix_accounts_user ON accounts (user_id);
CREATE INDEX ix_accounts_parent ON accounts (parent_account_id);

-- ---------------------------------------------------------------------
-- credits (1:1 with DEBTOR accounts)
-- ---------------------------------------------------------------------
CREATE TABLE credits (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id       BIGINT         NOT NULL REFERENCES accounts (id),
    credit_limit     NUMERIC(19, 2) NOT NULL,
    cut_off_cron     VARCHAR(100)   NOT NULL,
    payment_due_cron VARCHAR(100)   NOT NULL,
    cut_off_day      DATE           NOT NULL,
    payment_due_day  DATE           NOT NULL,
    created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_credits_account UNIQUE (account_id),
    CONSTRAINT ck_credits_limit_positive CHECK (credit_limit > 0)
);

-- ---------------------------------------------------------------------
-- schedules (scheduled transactions)
-- ---------------------------------------------------------------------
CREATE TABLE schedules (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                BIGINT         NOT NULL REFERENCES users (id),
    type                   VARCHAR(20)    NOT NULL,
    origin_account_id      BIGINT         NOT NULL REFERENCES accounts (id),
    destination_account_id BIGINT         REFERENCES accounts (id),
    amount                 NUMERIC(19, 2) NOT NULL,
    fee                    NUMERIC(19, 2) NOT NULL DEFAULT 0,
    description            VARCHAR(255)   NOT NULL,
    cron_expression        VARCHAR(100)   NOT NULL,
    next_execution         TIMESTAMP      NOT NULL,
    last_execution         TIMESTAMP,
    status                 VARCHAR(10)    NOT NULL DEFAULT 'ACTIVE',
    created_at             TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_schedules_type CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'INVEST', 'PROFIT',
        'DIVIDEND', 'INTEREST', 'BORROW', 'COLLECTION', 'DEBT', 'PAYMENT')),
    CONSTRAINT ck_schedules_status CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED')),
    CONSTRAINT ck_schedules_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_schedules_fee_non_negative CHECK (fee >= 0),
    CONSTRAINT ck_schedules_description_length CHECK (char_length(description) BETWEEN 3 AND 255),
    CONSTRAINT ck_schedules_distinct_accounts CHECK (
        destination_account_id IS NULL OR destination_account_id <> origin_account_id)
);

CREATE INDEX ix_schedules_user_next_execution ON schedules (user_id, next_execution);

-- ---------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
    id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                    BIGINT         NOT NULL REFERENCES users (id),
    uuid                       UUID           NOT NULL,
    batch_uuid                 UUID           NOT NULL,
    schedule_id                BIGINT         REFERENCES schedules (id),
    type                       VARCHAR(20)    NOT NULL,
    operation_type             VARCHAR(15)    NOT NULL,
    origin_account_id          BIGINT         NOT NULL REFERENCES accounts (id),
    destination_account_id     BIGINT         REFERENCES accounts (id),
    amount                     NUMERIC(19, 2) NOT NULL,
    fee                        NUMERIC(19, 2) NOT NULL DEFAULT 0,
    description                VARCHAR(255)   NOT NULL,
    origin_balance_before      NUMERIC(19, 2),
    origin_balance_after       NUMERIC(19, 2),
    destination_balance_before NUMERIC(19, 2),
    destination_balance_after  NUMERIC(19, 2),
    -- Whether the pending effect is already reflected; reports use applied_at.
    applied                    BOOLEAN        NOT NULL,
    operation_date             TIMESTAMP      NOT NULL,
    applied_at                 TIMESTAMP,
    created_at                 TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_transactions_uuid UNIQUE (uuid),
    CONSTRAINT ck_transactions_type CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'INVEST', 'PROFIT',
        'DIVIDEND', 'INTEREST', 'BORROW', 'COLLECTION', 'DEBT', 'PAYMENT')),
    CONSTRAINT ck_transactions_operation_type CHECK (operation_type IN ('ADDITION', 'SUBTRACTION', 'NEUTER')),
    CONSTRAINT ck_transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_transactions_fee_non_negative CHECK (fee >= 0),
    CONSTRAINT ck_transactions_description_length CHECK (char_length(description) BETWEEN 3 AND 255),
    CONSTRAINT ck_transactions_distinct_accounts CHECK (
        destination_account_id IS NULL OR destination_account_id <> origin_account_id),
    CONSTRAINT ck_transactions_applied_at CHECK (
        (applied = TRUE AND applied_at IS NOT NULL) OR (applied = FALSE AND applied_at IS NULL)),
    CONSTRAINT ck_transactions_balances_non_negative CHECK (
        (origin_balance_before IS NULL OR origin_balance_before >= 0)
        AND (origin_balance_after IS NULL OR origin_balance_after >= 0)
        AND (destination_balance_before IS NULL OR destination_balance_before >= 0)
        AND (destination_balance_after IS NULL OR destination_balance_after >= 0))
);

CREATE INDEX ix_transactions_user_operation_date ON transactions (user_id, operation_date);
CREATE INDEX ix_transactions_user_applied_at ON transactions (user_id, applied_at);
CREATE INDEX ix_transactions_origin_operation_date ON transactions (origin_account_id, operation_date);
CREATE INDEX ix_transactions_destination_operation_date ON transactions (destination_account_id, operation_date);
CREATE INDEX ix_transactions_user_type ON transactions (user_id, type);
CREATE INDEX ix_transactions_batch ON transactions (batch_uuid);

-- ---------------------------------------------------------------------
-- goals (annual savings goals)
-- ---------------------------------------------------------------------
CREATE TABLE goals (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT         NOT NULL REFERENCES users (id),
    year          INTEGER        NOT NULL,
    target_amount NUMERIC(19, 2) NOT NULL,
    created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_goals_user_year UNIQUE (user_id, year),
    CONSTRAINT ck_goals_target_positive CHECK (target_amount > 0)
);
