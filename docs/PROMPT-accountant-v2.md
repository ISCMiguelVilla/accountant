# Prompt — Accountant v2 (proyecto nuevo desde cero)

> Versión del prompt: **borrador 3**.

---

## 0. Rol e instrucciones generales

Eres un desarrollador full-stack senior. Vas a construir **Accountant**, una aplicación web de finanzas personales (multiusuario, uso doméstico, solo en local) **desde cero**, dentro de la estructura base que ya existe en el repositorio. No hay código heredado: todo lo descrito aquí es la especificación completa.

Reglas de trabajo:
- Trabaja por **fases** (sección 13). Al terminar cada fase el proyecto debe compilar, arrancar y pasar sus pruebas.
- El **backend es la única fuente de verdad** de las reglas de negocio. El frontend replica el motor de cálculo solo para dar retroalimentación inmediata y obtiene del backend la matriz de reglas (`GET /transactions/rules`); el backend siempre vuelve a validar y recalcular.
- Código, identificadores, endpoints, códigos de error y logs en **inglés**. La interfaz es **bilingüe (español / inglés)** mediante i18n (sección 9).
- Dinero: nunca `double`/`float` en backend (`BigDecimal`, `NUMERIC(19,2)`). En frontend, todos los cálculos en **centavos enteros** (`number` entero) con una única utilidad de conversión/redondeo; solo se convierte a decimal para mostrar o enviar al API.
- **Ninguna cuenta puede quedar con saldo negativo**, sea cual sea el tipo de cuenta o de transacción.
- Zona horaria de la aplicación: **`America/Mexico_City`** (JVM, Hibernate `jdbc.time_zone` y formateo en front).
- Las transacciones persistidas **no se editan ni se anulan** en este alcance. El control antes de guardar es el resumen de movimientos del editor de lotes (5.6).
- No introduzcas dependencias fuera de las listadas sin justificarlo.

---

## 1. Stack tecnológico

### Backend
- **Java 21**, **Spring Boot 4.1.1**, **Maven** (con Maven Wrapper `mvnw`). Usa los starters/módulos propios de Spring Boot 4 (Spring Framework 7, Hibernate 7, Jackson 3).
- Spring Web MVC, Spring Data JPA, Spring Security + JWT (`jjwt`), Bean Validation, Spring Boot Actuator (solo `health`), Spring Scheduling (`@Scheduled`).
- **Flyway** (starter de Flyway de Boot 4 + `flyway-database-postgresql`). Hibernate con `ddl-auto=validate`.
- **PostgreSQL** (driver `org.postgresql`).
- Lombok + MapStruct.
- springdoc-openapi (versión compatible con Boot 4), Swagger UI habilitado solo en perfil `dev`.
- **Spotless** (formato Java) integrado en el build.
- Pruebas: JUnit 5, AssertJ, Mockito, Spring Boot Test. **Sin Testcontainers.**

### Frontend
- **Angular** (versión compatible con PrimeNG 21; se usa Angular 21), componentes **standalone**, control flow (`@if`, `@for`), **signals** para estado, `inject()`, formularios reactivos tipados.
- **PrimeNG v21** (licencia MIT; la v22 requiere clave de licencia PrimeUI), tema **Aura** con preset personalizado: **Primary = `noir`**, **Surface = `slate`** (con soporte de modo oscuro).
- **Tailwind CSS** + plugin `tailwindcss-primeui`.
- **PrimeIcons**.
- Gráficos con **PrimeNG `p-chart`** (Chart.js).
- i18n: **`@ngx-translate/core`** + `@ngx-translate/http-loader` (cambio de idioma en caliente, un solo build).
- Fechas: `date-fns` (con locales `es` y `enUS`). No usar `moment`.
- **ESLint + Prettier**.

### Infraestructura
- PostgreSQL instalado en el equipo físico (fuera de Docker).
- Docker + Docker Compose para "producción local": **NGINX** (sirve el build de Angular y hace *reverse proxy* al backend) + Spring Boot.

---

## 2. Estructura del repositorio (monorepo)

```
accountant/
├── backend/                  # Spring Boot (Maven)
├── frontend/                 # Angular + PrimeNG
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx/default.conf
├── docs/
│   ├── business-rules.md     # reglas de negocio (sección 5) en prosa + tablas
│   └── transaction-cases.json# casos de prueba compartidos por back y front (sección 12)
├── docker-compose.yml
├── .env.example              # variables para docker-compose (sin secretos reales)
└── README.md                 # cómo levantar dev y prod-local
```

### 2.1 Backend — paquetes por *feature*
Paquete base: **`com.devs.accountant`**

```
devs/accountant/
├── AccountantApplication.java
├── shared/            # config, security, exceptions (ProblemDetail), paging/filter utils, CurrentUser, clock/timezone
├── auth/              # sign-in, sign-up, JWT
├── user/              # admin de usuarios
├── currency/          # catálogo de monedas (ilustrativo)
├── account/           # cuentas + jerarquía
├── credit/            # entidad Credit (1:1 con Account DEBTOR) + job de fechas
├── transaction/       # transacciones + motor de reglas (engine/)
├── schedule/          # transacciones programadas (cron)
├── goal/              # metas anuales
├── dashboard/         # balance, gastos por concepto, resumen, progreso
└── calendar/          # vista calendario
```
Dentro de cada feature: `XxxController`, `XxxService` (interfaz) + `XxxServiceImpl`, `XxxRepository`, `Xxx` (entidad), `dto/` (`XxxRequest`, `XxxResponse`, `XxxFilter`), `XxxMapper` (MapStruct).

### 2.2 Frontend
```
src/app/
├── core/          # auth (guard, interceptor, service), layout (topbar, sidebar, menu), http error handler, i18n setup, theme
├── shared/        # componentes reutilizables (amount, account-card, money utils/pipe), enums, models, pipes
├── features/
│   ├── auth/      # sign-in, sign-up, sign-out
│   ├── home/      # tabs: Resumen | Calendario
│   ├── accounts/  # list (paginado), form, detail (con últimas transacciones)
│   ├── transactions/ # list (paginado), batch editor (staging local), engine/
│   ├── schedules/
│   └── admin/     # users, currencies
├── app.routes.ts
public/i18n/es.json, public/i18n/en.json
```
Convenciones: un archivo por enum/modelo (`account-type.enum.ts`, `account.model.ts`), servicios HTTP `xxx-api.service.ts`, páginas `xxx-list.page.ts` / `xxx-form.page.ts` / `xxx-detail.page.ts`, rutas *lazy* por feature (`xxx.routes.ts`).

---

## 3. Ambientes

Backend con **`server.servlet.context-path=/accountant`**. Todos los endpoints de la sección 7 son relativos a ese context path (p. ej. `/accountant/accounts`). El frontend usa `environment.apiUrl = '/accountant'`.

### 3.1 Desarrollo
- Front: `npm start` (ng serve en 4200) con `proxy.conf.json`: `/accountant` → `http://localhost:8080`.
- Back: `mvn spring-boot:run`, perfil por defecto **`dev`**, puerto 8080.
- BD: `jdbc:postgresql://localhost:5432/accountant_dev`.
- Credenciales de BD y secreto JWT por variables de entorno (`DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`) con valores por defecto **solo** en `application-dev.yml` para facilitar el arranque local; nunca contraseñas reales versionadas.
- Flyway: `classpath:db/migration` + `classpath:db/seed-dev` (semilla solo en dev).
- CORS permitido solo para `http://localhost:4200`. Swagger UI habilitado. Logs SQL activables.

### 3.2 "Producción" local (Docker)
- `docker compose up -d --build` levanta:
  - `frontend`: imagen multi-stage (node → `ng build` prod → `nginx:alpine`). NGINX sirve el SPA (`try_files $uri $uri/ /index.html`) y hace proxy de `/accountant/` → `http://backend:8080/accountant/`.
  - `backend`: imagen multi-stage (`maven:3-eclipse-temurin-21` → `eclipse-temurin:21-jre`), perfil **`prod`**. **No publica puertos al host** (solo `expose` en la red interna de compose).
- **Solo NGINX expone puerto al host**: `${APP_PORT:-8085}:80`.
- El backend se conecta al **Postgres del equipo físico**: `jdbc:postgresql://host.docker.internal:5432/accountant`, con `extra_hosts: ["host.docker.internal:host-gateway"]`. El README documenta que Postgres debe aceptar conexiones desde la red de Docker (`listen_addresses`, `pg_hba.conf`).
- Variables en `.env` (no versionado) + `.env.example`: `APP_PORT`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MINUTES`.
- Swagger deshabilitado; CORS innecesario (mismo origen vía NGINX).
- `restart: unless-stopped`; healthcheck del backend en `/accountant/actuator/health`; `frontend` `depends_on` backend saludable.

---

## 4. Modelo de datos

Convenciones de BD: tablas `snake_case` plural, PK `id BIGINT GENERATED ALWAYS AS IDENTITY`, FKs `<entidad>_id`, enums como `VARCHAR` + `CHECK`, dinero `NUMERIC(19,2)`, fechas `TIMESTAMP` en hora de `America/Mexico_City`. Todo registro de negocio pertenece a un `user_id` y **toda consulta filtra por el usuario autenticado** (incluidos reportes).

### 4.1 `users`
`id, name, username (unique), password (BCrypt), role (ADMIN|USER), status (ACTIVE|DISABLED), preferred_language (es|en), created_at, updated_at`.
- **Solo existe un ADMIN**: el primer usuario registrado. Los siguientes son USER.
- Garantizarlo en BD con índice único parcial: `CREATE UNIQUE INDEX ux_users_single_admin ON users(role) WHERE role = 'ADMIN';` (evita condiciones de carrera en el primer registro).
- El ADMIN no puede deshabilitarse ni cambiar de rol; no se puede promover a ningún USER a ADMIN.

### 4.2 `currencies` (catálogo global, administrado por ADMIN)
`id, name (unique), iso (unique, 3 letras), symbol, status, created_at, updated_at`. Semilla: MXN, USD.
> **Multi-moneda fuera de alcance**: la moneda de una cuenta es **ilustrativa** (se muestra junto al saldo). No hay validaciones de moneda entre origen y destino, ni conversiones, ni totales por moneda: los totales suman todas las cuentas. Las reglas multi-moneda se definirán en un alcance futuro.

### 4.3 `accounts`
| Campo | Notas |
|---|---|
| `id`, `user_id` | |
| `currency_id` | obligatorio (ilustrativo) |
| `parent_account_id` | nullable, jerarquía (sub-cuentas) |
| `name` | único por (`user_id`, `name`, `type`) entre cuentas no DELETED |
| `type` | ver 5.1 |
| `balance` | `NUMERIC(19,2)`; **NULL** para tipos sin saldo (GROUP, SUPPLIER, CONSUMER); `CHECK (balance >= 0)` |
| `pending_expense` | `NUMERIC(19,2)`, solo DEBTOR (NULL en el resto): parte de la deuda que **se reconocerá como gasto cuando se pague** (ver 5.3). `CHECK (0 <= pending_expense <= balance)` |
| `icon` (clase PrimeIcons), `color` (HEX mayúsculas) | |
| `include_in_balance` | si cuenta para totales/resumen del home |
| `is_temporary` | cuenta temporal (ver 5.1 regla 10) |
| `status` | ACTIVE, DISABLED, DELETED |
| `version` | `@Version` (bloqueo optimista) |
| `created_at`, `updated_at` | |

### 4.4 `credits` — 1:1 con `accounts` (solo DEBTOR)
| Campo | Notas |
|---|---|
| `id`, `account_id` (unique FK) | la cuenta debe ser de tipo **DEBTOR** |
| `credit_limit` | `NUMERIC(19,2)` > 0 |
| `cut_off_cron` | expresión cron (Spring, 6 campos) que define las fechas de corte, p. ej. `0 0 0 15 * *` (día 15) o `0 0 0 L * *` (último día del mes) |
| `payment_due_cron` | expresión cron que define las fechas límite de pago, p. ej. `0 0 0 5 * *` |
| `cut_off_day` | `DATE`: **próxima fecha de corte** (≥ hoy), calculada a partir de `cut_off_cron` |
| `payment_due_day` | `DATE`: **próxima fecha límite de pago** (≥ hoy), calculada a partir de `payment_due_cron` |
| `created_at`, `updated_at` | |

Cálculo de fechas:
- Al crear o modificar un Credit (o sus crons), `cut_off_day` y `payment_due_day` se calculan con `CronExpression.next(ayer 23:59:59)` (la fecha de hoy cuenta si coincide).
- **Actualización periódica**: un job `@Scheduled` diario (00:05 `America/Mexico_City`) y una ejecución al **arrancar la aplicación** (por si el contenedor estuvo apagado) recorren los Credit cuya fecha guardada ya pasó (`< hoy`) y la avanzan a la siguiente ocurrencia del cron (≥ hoy). El job es idempotente.
- En el formulario hay un modo simple ("día N de cada mes" / "último día del mes") que genera la expresión, y un modo avanzado para escribir el cron; ambos muestran las próximas 3 fechas (`GET /schedules/cron/check`).
- Cards, detalle de cuenta y avisos usan las fechas guardadas; el calendario usa las guardadas y expande los crons para meses posteriores.
- Derivado (no persistido): `availableCredit = credit_limit − balance`, `usagePercentage`.
- Una cuenta con Credit no puede cambiar a un tipo distinto de DEBTOR.

### 4.5 `transactions`
| Campo | Notas |
|---|---|
| `id`, `user_id` | |
| `uuid` | UUID generado en cliente, único |
| `batch_uuid` | UUID del lote con el que se guardó |
| `schedule_id` | nullable, si proviene de una transacción programada |
| `type`, `operation_type` | ver 5.2 / 5.3 |
| `origin_account_id` | obligatorio |
| `destination_account_id` | nullable según el tipo |
| `amount` | > 0 |
| `fee` | ≥ 0 (comisión/retención/cargo; ver 5.4) |
| `reported_amount` | `NUMERIC(19,2)` ≥ 0: monto que cuenta en reportes como ingreso (ADDITION) o gasto (SUBTRACTION); 0 en NEUTER. Lo calcula el motor (ver 5.3) |
| `description` | 3–255 |
| `origin_balance_before`, `origin_balance_after` | saldo del origen antes/después (NULL si la cuenta no tiene saldo) |
| `destination_balance_before`, `destination_balance_after` | idem destino |
| `applied` | si el efecto pendiente ya se reflejó (ver 5.5) |
| `operation_date` | fecha del movimiento; determina el orden de cálculo |
| `applied_at` | fecha en que se reflejó (= `operation_date` si nace aplicada; NULL si pendiente) |
| `created_at`, `updated_at` | |

Índices: (`user_id`, `operation_date`), (`user_id`, `applied_at`), (`origin_account_id`, `operation_date`), (`destination_account_id`, `operation_date`), (`user_id`, `type`).

### 4.6 `schedules` (transacciones programadas)
`id, user_id, type, origin_account_id, destination_account_id (nullable según tipo), amount, fee, description, cron_expression (Spring, 6 campos), next_execution, last_execution, status (ACTIVE|DISABLED|DELETED), created_at, updated_at`.

### 4.7 `goals` (metas anuales de ahorro)
`id, user_id, year, target_amount NUMERIC(19,2) > 0, created_at, updated_at`, `UNIQUE (user_id, year)`. Ver 6.1.4.

---

## 5. Reglas de negocio

### 5.1 Tipos de cuenta

| Tipo | Significado | ¿Saldo? | Sub-cuentas permitidas |
|---|---|---|---|
| `GROUP` | Agrupador jerárquico. Nunca participa en transacciones. | No | Cualquier tipo |
| `SUPPLIER` | Fuente de ingresos (empleador, cliente). | No | SUPPLIER |
| `STORAGE` | Donde se guarda dinero (banco, efectivo). | Sí | STORAGE, INVESTMENT, DEBTOR |
| `CONSUMER` | Concepto de gasto (comida, casa, transporte). | No | CONSUMER |
| `BUSINESS` | Negocio propio. | Sí | STORAGE, INVESTMENT |
| `INVESTMENT` | Inversión. | Sí | **INVESTMENT** |
| `CREDITOR` | Cuenta por cobrar: dinero que **yo presté**. Saldo = lo que me deben. | Sí | CREDITOR |
| `DEBTOR` | Cuenta por pagar / crédito: dinero que **yo debo** (tarjeta, préstamo). Saldo = lo que debo. Puede tener `Credit`. | Sí | DEBTOR |

Reglas de cuentas:
1. `balance` se fuerza a NULL para GROUP, SUPPLIER, CONSUMER. Para el resto, saldo ≥ 0 siempre.
2. Nombre único por usuario + tipo (entre cuentas no eliminadas).
3. El padre debe existir, pertenecer al usuario, no estar DELETED y aceptar el tipo hijo (tabla anterior).
4. **Prohibido crear ciclos**: el nuevo padre no puede ser la propia cuenta ni ningún descendiente de **todo** su subárbol (hijos, nietos, etc.). Resolver con CTE recursiva en Postgres.
5. **Cambio de tipo**:
   - El nuevo tipo debe seguir aceptando todas sus sub-cuentas no eliminadas.
   - Si la cuenta **tiene movimientos** (transacciones), solo puede cambiar a los tipos permitidos como sub-cuenta por **el grupo al que pertenece** (su cuenta padre), nunca a GROUP. Una cuenta raíz (sin padre) con movimientos solo puede cambiar entre STORAGE ↔ INVESTMENT.
   - Para cambiar a un tipo sin saldo (GROUP, SUPPLIER, CONSUMER) el saldo debe ser 0.
   - Una cuenta con Credit debe seguir siendo DEBTOR.
   - **Actualización parcial**: `PUT /accounts/{id}` solo modifica las propiedades enviadas; las ausentes conservan su valor y el `id` nunca cambia. Un `null` explícito limpia `parentId`, `icon` o `color`.
6. **Edición manual de saldo**: el formulario de cuentas permite modificar el saldo (≥ 0) aunque la cuenta ya tenga transacciones. Se sobrescribe directamente; **no genera transacción**. Al hacerlo se incrementa `version`, de modo que un borrador de lote abierto detecta el cambio (5.6 punto 10). En DEBTOR también se puede editar `pending_expense` (por defecto igual al saldo al crear la cuenta; si el saldo baja por debajo, se ajusta al nuevo saldo).
7. Cuentas usables en transacciones: ACTIVE y distintas de GROUP.
8. Cuentas "en uso" (cards y resumen del home): ACTIVE, `include_in_balance = true`, `balance > 0`, tipo distinto de SUPPLIER, GROUP, CONSUMER.
9. **Borrado lógico** (`status = DELETED`). No se puede borrar si `balance ≠ 0` (NULL cuenta como 0) o si tiene sub-cuentas no eliminadas. Las cuentas DISABLED pueden reactivarse manualmente.
10. **Cuentas temporales** (`is_temporary`): solo para INVESTMENT y BUSINESS (los tipos que pueden ser origen de PROFIT). Cuando se registra un **PROFIT** cuyo origen es una cuenta temporal, al aplicar esa transacción la cuenta pasa automáticamente a **`DISABLED`** (la inversión cumplió su función). Consecuencias:
    - En el editor de lotes se muestra un aviso antes de agregar la transacción ("esta cuenta temporal se deshabilitará"), indicando si queda saldo remanente.
    - Dentro del mismo lote, cualquier transacción posterior que use esa cuenta falla con `ACCOUNT_DISABLED`.
    - Para volver a usarla, se reactiva manualmente desde el formulario de cuentas.

### 5.2 Tipos de transacción y cuentas permitidas

| Tipo | Origen | Destino | Destino es |
|---|---|---|---|
| `INCOME` | SUPPLIER | STORAGE | obligatorio |
| `EXPENSE` | STORAGE, **DEBTOR** | CONSUMER | obligatorio |
| `TRANSFER` | STORAGE | STORAGE | obligatorio |
| `INVEST` | STORAGE, INVESTMENT | INVESTMENT, BUSINESS | obligatorio |
| `PROFIT` | INVESTMENT, BUSINESS | STORAGE, INVESTMENT | obligatorio |
| `DIVIDEND` | INVESTMENT, BUSINESS, STORAGE, CREDITOR | INVESTMENT, BUSINESS, STORAGE, CREDITOR | opcional |
| `INTEREST` | INVESTMENT, BUSINESS, STORAGE, DEBTOR | — | prohibido |
| `BORROW` (prestar) | STORAGE | CREDITOR | obligatorio |
| `COLLECTION` (cobrar préstamo) | CREDITOR | STORAGE | obligatorio |
| `DEBT` (endeudarse) | DEBTOR | STORAGE, CONSUMER | obligatorio |
| `PAYMENT` (pagar deuda) | STORAGE | DEBTOR | obligatorio |

Reglas generales: origen ≠ destino; ambas cuentas ACTIVE y del usuario. Sin validación de moneda.

### 5.3 Tipo de operación y monto reportado
Principio: **el gasto se reconoce cuando realmente sale dinero propio**. Comprar a crédito, endeudarse o generar intereses sobre una deuda **no** es gasto en ese momento; el gasto se reconoce al **pagar** la parte de la deuda que corresponde a consumo. Pedir dinero prestado en efectivo tampoco es gasto: el gasto aparece cuando ese efectivo se usa (EXPENSE desde STORAGE).

| Tipo / variante | `operation_type` | `reported_amount` |
|---|---|---|
| INCOME | ADDITION | `A − F` |
| DIVIDEND | ADDITION | `A − F` |
| EXPENSE desde STORAGE | SUBTRACTION | `A + F` |
| INTEREST sobre cuenta ≠ DEBTOR | SUBTRACTION | `A` |
| PAYMENT | SUBTRACTION si `reported_amount > 0`, si no NEUTER | `F + min(A, pending_expense del DEBTOR antes del pago)` |
| EXPENSE desde DEBTOR (compra con tarjeta) | NEUTER | 0 |
| INTEREST sobre DEBTOR | NEUTER | 0 |
| DEBT → CONSUMER (compra a crédito) | NEUTER | 0 |
| DEBT → STORAGE (préstamo en efectivo) | NEUTER | 0 |
| TRANSFER, INVEST, PROFIT, BORROW, COLLECTION | NEUTER | 0 |

**`pending_expense` de las cuentas DEBTOR** (gasto por reconocer), lo mantiene el motor:
- Aumenta con: EXPENSE desde DEBTOR (`+ (A + F)`), DEBT → CONSUMER (`+ A`), INTEREST sobre DEBTOR (`+ A`), DEBT → STORAGE (`+ F`, la comisión es un costo).
- **No** aumenta con el principal de DEBT → STORAGE (préstamo en efectivo): ese dinero se reconocerá como gasto cuando se use desde STORAGE.
- PAYMENT: se reconoce primero la parte de consumo: `recognized = min(A, pending_expense)`; `pending_expense −= recognized`; `reported_amount = F + recognized`. El resto de A solo reduce la deuda (NEUTER).
- Se mantiene `0 ≤ pending_expense ≤ balance`.

Los reportes (balance, doughnut, calendario, progreso) suman **`reported_amount`** de las transacciones aplicadas. El endpoint de reglas expone el `operation_type` por tipo y tipo de origen/destino (PAYMENT se resuelve en el motor).

### 5.4 Efecto de cada transacción sobre los saldos
Notación: `A` = amount, `F` = fee (0 si nulo). "Pendiente" = el efecto solo ocurre cuando `applied = true`. Toda validación de "no negativo" se hace sobre el saldo resultante.

| Tipo | Validaciones | Origen | Destino |
|---|---|---|---|
| INCOME | `F < A` | (sin saldo) | `+ (A − F)` |
| EXPENSE (desde STORAGE) | origen ≥ A + F → `INSUFFICIENT_FUNDS` | `− (A + F)` **pendiente** | (sin saldo) |
| EXPENSE (desde DEBTOR) | si tiene Credit: saldo + A + F ≤ límite → `CREDIT_LIMIT_EXCEEDED` | `+ (A + F)` **pendiente** (la deuda crece) | (sin saldo) |
| TRANSFER / INVEST / PROFIT | origen ≥ A → `INSUFFICIENT_FUNDS`; `F < A` | `− A` (inmediato) | `+ (A − F)` **pendiente** (dinero en tránsito) |
| DIVIDEND | `F < A` | sin destino: `+ (A − F)` | con destino: `+ (A − F)` |
| INTEREST (origen ≠ DEBTOR) | origen ≥ A → `INSUFFICIENT_FUNDS`; F deshabilitado | `− A` | — |
| INTEREST (origen DEBTOR) | si tiene Credit: saldo + A ≤ límite → `CREDIT_LIMIT_EXCEEDED`; F deshabilitado | `+ A` (la deuda crece) | — |
| BORROW | origen ≥ A → `INSUFFICIENT_FUNDS`; F deshabilitado | `− A` | `+ A` |
| COLLECTION | A ≤ saldo del CREDITOR → `SENSELESS_TRANSACTION`; F deshabilitado | `− A` | `+ A` |
| DEBT → STORAGE | si tiene Credit: saldo + A ≤ límite → `CREDIT_LIMIT_EXCEEDED`; `F < A` | `+ A` | `+ (A − F)` |
| DEBT → CONSUMER | si tiene Credit: saldo + A ≤ límite → `CREDIT_LIMIT_EXCEEDED`; F deshabilitado | `+ A` | **sin efecto** (CONSUMER no tiene saldo; igual en front y back) |
| PAYMENT | origen ≥ A + F → `INSUFFICIENT_FUNDS`; A ≤ saldo del DEBTOR → `SENSELESS_TRANSACTION` | `− (A + F)` (F = comisión pagada) | `− A` (solo lo abonado reduce la deuda) |

Además, en cada transacción que involucra un DEBTOR se actualiza `pending_expense` según 5.3.

Campos del formulario según tipo (todo esto viene de `GET /transactions/rules`):
- `fee` habilitado solo donde la tabla lo usa (deshabilitado y = 0 en INTEREST, BORROW, COLLECTION, DEBT → CONSUMER).
- **Pendiente permitido** solo en EXPENSE (ambos orígenes), TRANSFER, INVEST y PROFIT. En el resto `applied = true` forzado y `applied_at = operation_date` (incluye **PAYMENT, que siempre se aplica en el momento**).
- Descripción autogenerada `"<tipo traducido> <origen> → <destino>"` mientras el usuario no la edite.
- Botón "usar saldo total" que copia el saldo disponible del origen al monto.
- **Vista previa de saldos en vivo**: conforme se modifica el monto (o fee, tipo, cuentas), el formulario muestra para el **origen** y para el **destino** (si aplica y tiene saldo) el **saldo original** (saldo proyectado justo antes de esta transacción, considerando las anteriores del lote) y el **saldo después de la transacción**, resaltando en rojo si el resultado es inválido y mostrando el error de validación traducido. En DEBTOR con Credit se muestra también el crédito disponible después.

### 5.5 Aplicación posterior de transacciones pendientes
`PATCH /transactions/{id}/apply` (idempotente: si ya está aplicada devuelve sin cambios):
- TRANSFER / INVEST / PROFIT: destino `+ (A − F)`.
- EXPENSE desde STORAGE: revalida fondos y origen `− (A + F)`.
- EXPENSE desde DEBTOR: revalida límite, origen `+ (A + F)` y `pending_expense += A + F`.
- Cualquier otro caso → `TRANSACTION_NOT_SUPPORTED`.
- Se registra `applied_at = now` y se **sobrescriben** los snapshots (`*_balance_before/after`) de la cuenta afectada con los valores de ese momento. No hay columnas adicionales.
- Al crear una transacción pendiente, el lado aún no afectado guarda `before = after = saldo actual`.

### 5.6 Motor de cálculo y guardado por lotes (núcleo de la app)
El usuario captura **un lote de transacciones** en un editor local antes de guardarlas. Como las transacciones persistidas no se editan ni anulan, **el resumen previo al guardado es el control principal** y debe ser claro y completo.

**Restricción de fechas:** `operation_date` de una transacción **no puede ser anterior a la última transacción ya persistida** de cada cuenta involucrada (origen y destino) → `DATE_BEFORE_LAST_TRANSACTION`. Así el recálculo siempre parte del saldo actual y nunca se reescribe el historial. El endpoint de cuentas usables devuelve `lastOperationDate` por cuenta y el datepicker del formulario aplica ese mínimo.

**Frontend (`TransactionEngine` puro en TS + `TransactionDraftStore`):**
1. Al abrir el editor se cargan: reglas (`/transactions/rules`), cuentas usables (snapshot "prístino" con `balance`, `pendingExpense`, `credit`, `version` y `lastOperationDate`) y programadas aplicables.
2. El borrador se guarda en `localStorage` con clave por usuario (`accountant:draft:<userId>`), incluyendo versión de esquema, fecha de creación y `version` de cada cuenta.
3. **Cada alta, edición o eliminación** de una transacción del borrador **recalcula todo desde cero**: clona las cuentas prístinas, ordena por `operation_date` ascendente (desempate estable por orden de captura) y aplica una por una (5.3 y 5.4, en centavos). Una edición o borrado intermedio revalida todas las posteriores.
4. Si alguna falla, la operación se rechaza, el borrador queda como estaba y se muestra un toast persistente con el error traducido e indicando la transacción que falló.
5. Las cuentas proyectadas resultantes alimentan los selectores (saldo mostrado = proyectado).
6. Selectores de origen/destino filtrados por la matriz de reglas, excluyendo la cuenta elegida en el otro selector y las cuentas DISABLED (incluidas las temporales deshabilitadas dentro del propio lote).
7. La tabla del lote muestra por transacción: fecha, tipo, origen, destino, monto, fee, aplicada, monto reportado y snapshots `before → after` de cada cuenta.
8. **"Revisar" (resumen de movimientos)** abre un diálogo con:
   - Cuentas afectadas (excluye SUPPLIER y CONSUMER): saldo actual → saldo proyectado y diferencia; en DEBTOR también crédito disponible y gasto por reconocer.
   - Totales del lote: ingresos, gastos y neto (por `reported_amount`), número de transacciones y cuántas quedan pendientes.
   - Avisos: cuentas temporales que se deshabilitarán, transacciones pendientes, programadas incluidas.
   - Botón "Guardar" solo desde este diálogo.
9. "Guardar" envía el lote a `POST /transactions/batch`. Al éxito se limpia el borrador. "Vaciar" borra el borrador con confirmación.
10. Al recargar la página se restaura y recalcula el borrador. Si alguna cuenta cambió de `version` (otra transacción o edición manual de saldo), se avisa que los saldos base cambiaron y se recalcula contra los nuevos (puede fallar y se informa).
11. Panel de programadas aplicables: "Aplicar" precarga el formulario (tipo, origen y destino bloqueados; fecha = hoy) con `schedule_id`. Una programada incluida en el borrador desaparece del panel.

**Backend (`TransactionEngine` en `transaction/engine`, puro, sin dependencias de Spring):**
1. `POST /transactions/batch` en **una sola transacción de BD**.
2. Valida estructura (Bean Validation), matriz de reglas, campos habilitados y restricción de fechas.
3. Carga las cuentas involucradas con **lock pesimista** (`PESSIMISTIC_WRITE`, en orden de id para evitar deadlocks), verifica que existan, sean del usuario y estén ACTIVE; `@Version` en cuentas para detectar ediciones concurrentes (`CONFLICT`).
4. Ordena por `operation_date` y aplica cada transacción con el motor, guardando `*_balance_before/after`, `reported_amount`, `operation_type`, actualizando `pending_expense` y aplicando la regla de cuentas temporales.
5. Si cualquier transacción falla → rollback total y error con `transactionUuid` e índice de la que falló.
6. Asigna `batch_uuid`, persiste transacciones y cuentas.
7. Para cada transacción con `schedule_id`: `last_execution = operation_date`, `next_execution = cron.next(next_execution anterior)`.

**Una sola definición de reglas:** `GET /transactions/rules` devuelve, por tipo: orígenes y destinos permitidos, modo de destino (`REQUIRED|OPTIONAL|NONE`), `feeEnabled` (por tipo y destino), `pendingAllowed` y `operationType` (por tipo y tipo de origen/destino). El front **no duplica** esta matriz; solo implementa los efectos aritméticos, probados con el mismo `docs/transaction-cases.json` que el backend.

### 5.7 Transacciones programadas
- Respetan **la misma lógica que las transacciones normales**: misma matriz de cuentas por tipo (destino obligatorio/opcional/prohibido), mismos campos habilitados, mismas validaciones de formato. Al aplicarse pasan por el editor de lotes y el motor (validación completa de saldos en ese momento).
- `cron_expression` en formato Spring (6 campos); `GET /schedules/cron/check?expression=&count=3` devuelve validez y próximas ejecuciones (lo reutiliza Credit).
- Al crear sin `next_execution`: `cron.next(hoy 00:00)`.
- "Aplicables": ACTIVE con `next_execution ≤ fin del día de mañana`.
- Acciones: activar/desactivar, saltar ejecución (`next_execution = cron.next(next_execution)`), editar, borrar lógico.
- Las ocurrencias futuras se expanden para el calendario.

---

## 6. Pantalla principal (Home) — dos tabs (`p-tabs`)

### 6.1 Tab "Resumen"
Todos los reportes usan `applied_at` (las pendientes no cuentan hasta aplicarse), suman `reported_amount`, solo del usuario, con consultas en Postgres (`date_trunc`, `generate_series`).

1. **Gráfica de balance (estado de resultados)**: barras de ingresos (ADDITION) y egresos (SUBTRACTION) + línea de neto (ingresos − egresos) por periodo. Excluye NEUTER.
   - Dimensiones y ventana: YEAR (2–4, default 2), MONTH (3–12, default 6), WEEK (4–12, default 4), DAY (7–15, default 7).
   - Controles: dimensión, ampliar/reducir ventana, mover referencia, volver a hoy. La ventana se centra en la referencia. Periodos sin datos se muestran en 0.
2. **Doughnut de gastos por concepto** con **selector de mes** (default mes actual; anterior/siguiente). Suma SUBTRACTION del mes agrupada por "concepto" = cuenta destino si existe (CONSUMER en EXPENSE, DEBTOR en PAYMENT) o cuenta origen (INTEREST), con el color de la cuenta. Total en el centro; estado vacío "Sin gastos".
3. **Cards de cuentas en uso** (5.1 regla 8): ícono, color, nombre, tipo, saldo, moneda; para DEBTOR con Credit: barra de uso de línea, crédito disponible y fechas `cut_off_day` / `payment_due_day`. Total general arriba. Card "Nueva cuenta" al final. Click → detalle.
4. **Resumen de cuentas y sub-cuentas agrupadas** (árbol, calculado en backend `/dashboard/summary`):
   - Raíces = cuentas sin padre; excluir SUPPLIER y CONSUMER.
   - `total` del nodo = su saldo + suma recursiva de hijos.
   - Eliminar nodos con saldo y total en 0.
   - Si un nodo queda con un único hijo hoja, colapsarlo en el padre ("padre › hijo").
   - Porcentaje de cada nodo respecto al total de su padre.
   - Render con `p-treetable` o lista anidada con barras de porcentaje.
5. **Progreso anual vs meta** (ver 6.1.4).

#### 6.1.4 Metas (`Goal`) — flujo simple
- Una meta por usuario y año: `target_amount` = cuánto se quiere ahorrar (neto) en el año. CRUD mínimo desde un diálogo en el propio widget (`GET /goals`, `PUT /goals/{year}`, `DELETE /goals/{year}`).
- `GET /dashboard/progress?years=3` devuelve por año (año actual y anteriores):
  - `net` mensual = ADDITION − SUBTRACTION (por `applied_at`, sobre `reported_amount`).
  - `accumulated` = suma de netos del año; `percentage = accumulated / target × 100` (tope 100, mínimo 0).
  - Meta mensual = `target / 12`. Estado del mes: `SUCCESS` si net ≥ meta mensual; `WARNING` si 0 ≤ net < meta mensual; `DANGER` si net < 0.
  - Estado del año: esperado a la fecha = `target × meses transcurridos / 12` (12 en años pasados). `SUCCESS` si accumulated ≥ esperado; `WARNING` si ≥ 50 % del esperado; `DANGER` en otro caso.
  - Años sin meta: se muestran los netos sin porcentaje ni estado.
- UI: por año una barra de progreso con estado y la lista de meses (tags de color) en un `p-timeline` o lista compacta.

### 6.2 Tab "Calendario"
- Vista mensual con grid de 7 columnas, **semana inicia en lunes**, navegación mes anterior/siguiente/hoy. Componente propio con CSS grid/Tailwind + componentes PrimeNG (`p-tag`, `p-badge`, `p-popover`/`p-drawer`). Nombres de días y meses según idioma.
- Por día:
  - Ingresos en verde `+$ 1,000.00` = suma de `reported_amount` ADDITION con `applied_at` ese día.
  - Egresos en rojo `-$ 1,000.00` = suma de `reported_amount` SUBTRACTION con `applied_at` ese día.
  - **No se incluyen NEUTER.**
  - Marcas de **fecha de corte** y **fecha límite de pago** de cada cuenta con Credit (fechas guardadas + ocurrencias de sus crons para meses posteriores); en la fecha de pago se muestra el saldo actual de la deuda.
  - **Transacciones programadas futuras** (ocurrencias del cron dentro del rango, solo ACTIVE y desde hoy) con monto y descripción, con estilo distinto (borde punteado / atenuado).
- Click en un día → panel con detalle (transacciones aplicadas ese día, eventos de crédito, programadas) y enlace al listado de transacciones filtrado por ese día.
- `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` (rango máx. 62 días; el front pide el mes visible completo incluyendo días de relleno):
  ```json
  { "days": [ { "date": "2026-10-02",
      "income": 1000.00, "expense": 250.00,
      "creditEvents": [ { "accountId": 7, "accountName": "Visa", "kind": "CUT_OFF|PAYMENT_DUE", "balance": 5300.00 } ],
      "scheduled": [ { "scheduleId": 3, "type": "EXPENSE", "description": "Internet", "amount": 599.00 } ] } ] }
  ```

---

## 7. API REST

Relativa a `/accountant`. JSON. Fechas ISO-8601. `Authorization: Bearer <jwt>` en todo excepto `/auth/**` y `/actuator/health`.

### 7.1 Paginado, filtrado y ordenamiento (todos los listados)
- Query params: `page` (0-based), `size` (default 20, máx 100), `sort=campo,asc|desc` (repetible) y filtros por campo.
- Respuesta estándar:
  ```json
  { "content": [...], "page": 0, "size": 20, "totalElements": 135, "totalPages": 7, "sort": [{"field":"operationDate","direction":"DESC"}] }
  ```
- Backend: `Pageable` + JPA `Specification` desde un `XxxFilter`; **lista blanca** de campos ordenables/filtrables por recurso (campo no permitido → 400). Utilidades genéricas reutilizables en `shared`.
- Frontend: `p-table` en modo **lazy** (`onLazyLoad`) que traduce paginación, orden y filtros de columna a query params; **el estado de la tabla se refleja en la URL** (query params de la ruta), de modo que recargar, compartir el enlace o volver atrás restaura la misma vista. Implementarlo como utilidad reutilizable para todas las tablas.

Filtros mínimos:
- **Accounts**: `name` (contiene), `type` (multi), `status` (multi), `parentId`, `includeInBalance`, `isTemporary`, `hasCredit`. Orden: `name, type, balance, createdAt`.
- **Transactions**: `type` (multi), `operationType`, `accountId` (origen **o** destino), `originId`, `destinationId`, `applied`, `dateFrom`, `dateTo` (sobre `operation_date`), `amountMin`, `amountMax`, `description` (contiene), `batchUuid`. Orden: `operationDate, appliedAt, amount, type, createdAt`.
- **Schedules**: `type`, `status`, `accountId`, `nextExecutionFrom/To`. Orden: `nextExecution, amount, description`.
- **Users / Currencies** (admin): `name`, `status`, (`role`). Orden: `name, createdAt`.

### 7.2 Endpoints
```
POST   /auth/sign-in                 POST /auth/sign-up

GET    /accounts                     (paginado)
GET    /accounts/options             (lista ligera para selects: usables, con balance, pendingExpense, credit, version, lastOperationDate)
GET    /accounts/in-use              (cards del home)
GET    /accounts/{id}                (incluye credit, availableCredit, hasChildren, hasTransactions)
GET    /accounts/{id}/transactions   (paginado, default size=10, sort=operationDate,desc)
POST   /accounts                     PUT /accounts/{id}    DELETE /accounts/{id}
PUT    /accounts/{id}/credit         DELETE /accounts/{id}/credit

GET    /transactions                 (paginado)
GET    /transactions/{id}
GET    /transactions/rules
POST   /transactions/batch
PATCH  /transactions/{id}/apply

GET    /schedules (paginado)         GET /schedules/applicable
POST   /schedules                    PUT /schedules/{id}
PATCH  /schedules/{id}/status        PATCH /schedules/{id}/skip
GET    /schedules/cron/check

GET    /goals                        PUT /goals/{year}    DELETE /goals/{year}

GET    /dashboard/income-statement?dimension=&size=&reference=
GET    /dashboard/expenses-by-concept?month=YYYY-MM
GET    /dashboard/summary
GET    /dashboard/progress?years=3

GET    /calendar?from=&to=

GET    /currencies/options
/admin/users/**   /admin/currencies/**      (rol ADMIN)
PATCH  /me/language                         (guarda idioma preferido)
```

### 7.3 Errores
`ProblemDetail` (RFC 7807) con propiedades `code`, `title`, `detail`, `timestamp`, y opcionales `params` (valores para interpolar el mensaje traducido), `errors` (por campo), `transactionUuid`.
Códigos: `VALIDATION_ERROR` (400), `MALFORMED_REQUEST` (400), `RESOURCE_NOT_FOUND` (404), `INSUFFICIENT_FUNDS` (422), `SENSELESS_TRANSACTION` (422), `TRANSACTION_NOT_SUPPORTED` (422), `CREDIT_LIMIT_EXCEEDED` (422), `DATE_BEFORE_LAST_TRANSACTION` (422), `ACCOUNT_DISABLED` (422), `ACCOUNT_NOT_DELETABLE` (422), `INVALID_CRON` (400), `CONFLICT` (409), `BAD_CREDENTIALS` (401), `FORBIDDEN` (403), `INTERNAL_SERVER_ERROR` (500, sin detalles internos).
El front traduce por `code` + `params` (los mismos códigos que lanza el motor TS), muestra toasts y redirige a sign-in en 401.

### 7.4 Seguridad
- JWT **HS256**, secreto por variable de entorno (`JWT_SECRET`, mínimo 256 bits), expiración configurable por `JWT_EXPIRATION_MINUTES`, **default 4 h**.
- Stateless, CSRF deshabilitado, BCrypt.
- Usuario autenticado vía componente `CurrentUser` (no repetir `SecurityContextHolder` en cada servicio).
- Rutas `/admin/**` solo ADMIN. Todo acotado al `user_id` autenticado.

---

## 8. Otras pantallas
- **Cuentas**: listado lazy/filtrable/ordenable (ícono, nombre, tipo con tag, padre, moneda, saldo, temporal, estado). Formulario: nombre, tipo, padre (filtrado por tipos válidos y sin ciclos), moneda, **saldo editable** (oculto si el tipo no tiene saldo; al editar una cuenta con transacciones muestra un aviso de que el cambio sobrescribe el saldo sin generar transacción), gasto por reconocer (solo DEBTOR), ícono (selector PrimeIcons), color, incluir en balance, temporal (solo INVESTMENT/BUSINESS), estado; sección **Crédito** solo para DEBTOR (línea, cron de corte, cron de pago, con vista de próximas fechas).
- **Detalle de cuenta**: datos, crédito (línea, usado, disponible, `cut_off_day`, `payment_due_day`, gasto por reconocer), sub-cuentas y **tabla de las últimas transacciones** donde la cuenta es origen o destino: fecha, tipo, contraparte, monto con signo según el efecto en esta cuenta, saldo antes → después, aplicada; acción "aplicar" en pendientes; enlace "ver todas" (listado de transacciones con `accountId`).
- **Transacciones**: listado lazy con filtros; acción "aplicar" en pendientes; botón "Nuevo lote" → editor (5.6).
- **Programadas**: listado lazy + formulario con verificador de cron y próximas ejecuciones.
- **Admin** (ADMIN): usuarios (sin crear otro admin) y monedas.
- **Auth**: sign-in, sign-up, sign-out; guard de rutas; layout con topbar (selector de idioma, modo claro/oscuro, usuario), sidebar con menú y breadcrumb.

Íconos y severidad por tipo (pipes `accountTypeIcon`, `accountTypeSeverity`, `transactionTypeIcon`), usando PrimeIcons: GROUP primary, SUPPLIER success, STORAGE warn, CONSUMER danger, BUSINESS success, INVESTMENT success, CREDITOR warn, DEBTOR danger.

---

## 9. Internacionalización (i18n)
- Idiomas: **español (`es`, default)** e **inglés (`en`)**. Archivos `public/i18n/es.json` y `en.json`, claves jerárquicas por feature (`accounts.form.name`, `enums.transactionType.INCOME`, `errors.INSUFFICIENT_FUNDS`, ...).
- Selector de idioma en el topbar; cambio en caliente sin recargar. Idioma inicial: preferencia del usuario (`users.preferred_language`) → `localStorage` → idioma del navegador → `es`.
- Traducir: textos de UI, enums (tipos de cuenta/transacción, estados), mensajes de error por `code` + `params`, validaciones de formularios, toasts y confirmaciones.
- Al cambiar idioma también cambian: locale de Angular (`es-MX` / `en-US`, registrar `localeData`) para pipes de fecha/número/moneda, traducciones de PrimeNG (datepicker, filtros de tabla, paginador, confirmaciones) y locale de `date-fns` (calendario, etiquetas de gráficas).
- El backend no traduce: responde códigos. Los datos del usuario (nombres de cuentas, descripciones) no se traducen.
- Prueba/lint que verifique que `es.json` y `en.json` tienen las mismas claves.

---

## 10. Migraciones Flyway
- `V1__init_schema.sql`: users (con índice único parcial de admin), currencies, accounts, credits, transactions, schedules, goals, índices y checks.
- `V2__seed_currencies.sql`: MXN, USD.
- `db/seed-dev/R__dev_seed.sql` (solo perfil dev): usuario de prueba y un set de cuentas de ejemplo de cada tipo (incluida una DEBTOR con Credit y una INVESTMENT temporal).
- Nunca modificar una migración ya aplicada; siempre nueva versión.

---

## 11. Calidad
- Backend: validación con Bean Validation en los `Request`; servicios `@Transactional`; logs SLF4J sin datos sensibles; sin lógica en controllers; Spotless (`spotless:check` en el build).
- Frontend: TypeScript estricto; ESLint + Prettier; servicios HTTP sin lógica de UI; motor de transacciones como clases puras (sin Angular) en `features/transactions/engine`.
- Formato de montos con `Intl.NumberFormat` según idioma, mostrando el código de moneda de la cuenta como etiqueta.

---

## 12. Pruebas mínimas
- `docs/transaction-cases.json`: casos `{ name, accounts:[...], transactions:[...], expected: { accounts:[{ id, balance, pendingExpense, status }], transactions:[{ uuid, operationType, reportedAmount, originBalanceBefore, originBalanceAfter, ... }] } | { error: { code, transactionUuid } } }` que cubran **cada tipo de transacción y variante de origen/destino**, cada validación (fondos, límite de crédito, senseless, no negativos, fee ≥ amount), aplicada vs pendiente, destino opcional, cuenta temporal deshabilitada por PROFIT (y uso posterior en el lote), reconocimiento de gasto en PAYMENT (deuda solo de consumo, solo de efectivo y mixta), recálculo tras editar/eliminar una transacción intermedia y redondeo de centavos.
- Backend: test parametrizado del `TransactionEngine` leyendo ese JSON; tests de servicio (Mockito) de batch (rollback total, snapshots, avance de programadas, restricción de fechas), apply, edición manual de saldo, reglas de cuentas (ciclos en todo el subárbol, cambio de tipo, borrado, único admin), cálculo y actualización periódica de `cut_off_day` / `payment_due_day`, expansión de cron en calendario, progreso de metas.
- Frontend: test del `TransactionEngine` TS con el mismo JSON; tests del `TransactionDraftStore` (persistencia, restauración, cambio de `version`); test de paridad de claves i18n.

---

## 13. Fases de entrega
1. **Andamiaje**: Maven + Angular + PrimeNG (tema Aura/noir/slate) + Tailwind + i18n + layout, perfiles dev/prod, Flyway V1, proxy dev, Spotless/ESLint/Prettier, README.
2. **Auth + admin** (usuarios con único admin, monedas) + utilidades genéricas de paginado/filtro/orden (back) y tabla lazy sincronizada con URL (front).
3. **Cuentas + Crédito** (CRUD, jerarquía, ciclos, borrado lógico, edición de saldo, job de fechas de crédito, detalle sin transacciones aún).
4. **Motor de transacciones backend**: reglas, batch, apply, temporales, `pending_expense` / `reported_amount` + tests con `transaction-cases.json`.
5. **Editor de lotes frontend** (motor TS, borrador local, vista previa de saldos, resumen de movimientos, guardado) + listado de transacciones + últimas transacciones en detalle de cuenta.
6. **Programadas**.
7. **Home – tab Resumen** (balance, doughnut por mes, cards, árbol, metas/progreso).
8. **Home – tab Calendario**.
9. **Docker prod-local** (Dockerfiles, NGINX, compose, `.env.example`) y verificación end-to-end.

---

## 14. Problemas del sistema anterior y cómo se resuelven en v2
- **D1** – `EXPENSE` desde DEBTOR (compra con tarjeta) **se acepta** en back y front: la deuda crece `+ (A + F)` (validando el límite de crédito) en lugar de exigir fondos.
- **D2** – `DEBT → CONSUMER` **no** modifica la cuenta CONSUMER (no tiene saldo); comportamiento idéntico en front y back.
- **D3** – `PAYMENT`: el fee se resta solo del origen (`− (A + F)`); la deuda se reduce solo por lo abonado (`− A`).
- **D4** – Todos los reportes filtran por usuario y usan funciones de Postgres.
- **D5** – `*_balance_before/after` se llenan siempre.
- **D6** – Dinero en front en centavos enteros.
- **D7** – Todos los tipos validan fondos/límites; **ningún saldo puede quedar negativo** (validación en motor + `CHECK` en BD).
- **D8** – Las programadas usan la misma matriz y validaciones que las transacciones normales.
- **D9** – La validación de ciclos revisa todo el subárbol.
- **D10** – JWT con expiración configurable (default 4 h) y secretos por variables de entorno.
- **D11** – Lock pesimista en batch/apply + `@Version` en cuentas.
