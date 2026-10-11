-- =====================================================================
-- Development seed (profile "dev" only; location classpath:db/seed-dev)
-- User: demo / demo12345 (role USER, so the first real sign-up is still the ADMIN)
-- One account of each type, a DEBTOR with a credit line and a temporary INVESTMENT.
-- Idempotent: does nothing if the demo user already exists.
-- =====================================================================
DO $$
DECLARE
    uid     BIGINT;
    mxn     BIGINT;
    usd     BIGINT;
    bancos  BIGINT;
    gastos  BIGINT;
    nomina  BIGINT;
    visa    BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE username = 'demo') THEN
        RETURN;
    END IF;

    INSERT INTO users (name, username, password, role, status, preferred_language)
    VALUES ('Usuario Demo', 'demo', '$2a$10$6DI1w0tku/gvMXgpYU/D5eCDsDikgEGDtnZx2OytWdpiKxafWSKbm', 'USER', 'ACTIVE', 'es')
    RETURNING id INTO uid;

    SELECT id INTO mxn FROM currencies WHERE iso = 'MXN';
    SELECT id INTO usd FROM currencies WHERE iso = 'USD';

    -- Groups
    INSERT INTO accounts (user_id, currency_id, name, type, icon, color)
    VALUES (uid, mxn, 'Bancos', 'GROUP', 'pi pi-building-columns', '#334155') RETURNING id INTO bancos;
    INSERT INTO accounts (user_id, currency_id, name, type, icon, color)
    VALUES (uid, mxn, 'Gastos', 'GROUP', 'pi pi-shopping-cart', '#64748B') RETURNING id INTO gastos;

    -- Storage
    INSERT INTO accounts (user_id, currency_id, parent_account_id, name, type, balance, icon, color)
    VALUES (uid, mxn, bancos, 'Cuenta nómina', 'STORAGE', 25000.00, 'pi pi-wallet', '#2563EB') RETURNING id INTO nomina;
    INSERT INTO accounts (user_id, currency_id, name, type, balance, icon, color)
    VALUES (uid, mxn, 'Efectivo', 'STORAGE', 1500.00, 'pi pi-money-bill', '#16A34A');
    INSERT INTO accounts (user_id, currency_id, parent_account_id, name, type, balance, icon, color)
    VALUES (uid, usd, bancos, 'Ahorro en dólares', 'STORAGE', 800.00, 'pi pi-dollar', '#0891B2');

    -- Supplier
    INSERT INTO accounts (user_id, currency_id, name, type, icon, color)
    VALUES (uid, mxn, 'Empresa ACME', 'SUPPLIER', 'pi pi-briefcase', '#15803D');

    -- Consumers (expense concepts)
    INSERT INTO accounts (user_id, currency_id, parent_account_id, name, type, icon, color) VALUES
        (uid, mxn, gastos, 'Comida', 'CONSUMER', 'pi pi-apple', '#DC2626'),
        (uid, mxn, gastos, 'Casa', 'CONSUMER', 'pi pi-home', '#EA580C'),
        (uid, mxn, gastos, 'Transporte', 'CONSUMER', 'pi pi-car', '#D97706'),
        (uid, mxn, gastos, 'Servicios', 'CONSUMER', 'pi pi-bolt', '#CA8A04');

    -- Debtor with credit line (dates in the past: the startup job moves them to the next occurrence)
    INSERT INTO accounts (user_id, currency_id, parent_account_id, name, type, balance, pending_expense, icon, color)
    VALUES (uid, mxn, nomina, 'Tarjeta Visa', 'DEBTOR', 5300.00, 5300.00, 'pi pi-credit-card', '#7C3AED')
    RETURNING id INTO visa;
    INSERT INTO credits (account_id, credit_limit, cut_off_cron, payment_due_cron, cut_off_day, payment_due_day)
    VALUES (visa, 30000.00, '0 0 0 15 * *', '0 0 0 5 * *', CURRENT_DATE - 1, CURRENT_DATE - 1);

    -- Investments (one temporary: disabled automatically by its PROFIT)
    INSERT INTO accounts (user_id, currency_id, name, type, balance, is_temporary, icon, color) VALUES
        (uid, mxn, 'CETES 28 días', 'INVESTMENT', 10000.00, TRUE, 'pi pi-chart-line', '#0D9488'),
        (uid, mxn, 'Fondo de inversión', 'INVESTMENT', 20000.00, FALSE, 'pi pi-chart-bar', '#059669');

    -- Business and creditor
    INSERT INTO accounts (user_id, currency_id, name, type, balance, icon, color)
    VALUES (uid, mxn, 'Tienda en línea', 'BUSINESS', 3000.00, 'pi pi-shop', '#4F46E5');
    INSERT INTO accounts (user_id, currency_id, name, type, balance, icon, color)
    VALUES (uid, mxn, 'Préstamo a Juan', 'CREDITOR', 2000.00, 'pi pi-user', '#B45309');
END $$;
