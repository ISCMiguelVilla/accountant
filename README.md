# Accountant

Aplicación web de **finanzas personales**, multiusuario y de uso doméstico, pensada para ejecutarse **en local** (en tu propio equipo o en tu red de casa). Permite registrar cuentas (bancos, efectivo, tarjetas de crédito, inversiones, préstamos…) y los movimientos de dinero entre ellas, y a partir de eso muestra cuánto tienes, cuánto debes, cuánto ganas, cuánto gastas y si vas cumpliendo tu meta de ahorro anual.

> **Estado del proyecto:** en construcción. Este README describe el sistema completo tal como está especificado en [`docs/PROMPT-accountant-v2.md`](docs/PROMPT-accountant-v2.md), que es la especificación de referencia. La implementación avanza por fases (ver [Hoja de ruta](#14-hoja-de-ruta-fases)). **Fases completadas:** 1 (andamiaje: perfiles, Flyway V1, errores `ProblemDetail`, tema PrimeNG, i18n ES/EN, layout, Spotless/ESLint/Prettier) 2 (autenticación JWT con único administrador, administración de usuarios y monedas, paginado/filtros/orden genéricos y tablas sincronizadas con la URL) 3 (cuentas con jerarquía y validación de ciclos, edición manual de saldo, borrado lógico, líneas de crédito con fechas de corte/pago calculadas por cron y job diario, semilla de desarrollo) y 4 (motor de transacciones del backend: reglas, lote atómico con bloqueo pesimista, transacciones pendientes con su aplicación posterior, cuentas temporales y tipo de operación para reportes, probado con los casos compartidos de `docs/transaction-cases.json`; el detalle está en [`docs/business-rules.md`](docs/business-rules.md)) y 5 (editor de lotes: motor TypeScript probado con los mismos casos compartidos y con la matriz de [`docs/transaction-rules.json`](docs/transaction-rules.json), borrador en el navegador con detección de saldos base cambiados, vista previa de saldos, resumen de movimientos y guardado atómico; listado de transacciones con filtros y acción "Aplicar"; últimas transacciones en el detalle de cuenta) y 6 (transacciones programadas: listado con filtros, formulario con las mismas reglas que una transacción y verificador de *cron*, activar/desactivar, saltar ejecución, borrado lógico y panel de programadas aplicables en el editor de lotes, que precarga el formulario y avanza la programada al guardar). El home (resumen y calendario) y Docker llegan en las siguientes fases.

---

## Tabla de contenido

1. [¿Qué es?](#1-qué-es)
2. [¿Qué hace?](#2-qué-hace)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Configuración](#5-configuración)
6. [Cómo levantar el proyecto](#6-cómo-levantar-el-proyecto)
7. [Cómo funciona el sistema (conceptos clave)](#7-cómo-funciona-el-sistema-conceptos-clave)
8. [Tipos de cuenta](#8-tipos-de-cuenta)
9. [Tipos de transacción](#9-tipos-de-transacción)
10. [Motor de cálculo y editor de lotes](#10-motor-de-cálculo-y-editor-de-lotes)
11. [Opciones del sistema (pantallas)](#11-opciones-del-sistema-pantallas)
12. [Flujos de uso](#12-flujos-de-uso)
13. [API REST (resumen)](#13-api-rest-resumen)
14. [Hoja de ruta (fases)](#14-hoja-de-ruta-fases)

---

## 1. ¿Qué es?

**Accountant** es un "contador personal": un libro de cuentas digital basado en **cuentas** y **transacciones**.

- Una **cuenta** representa un lugar o concepto por donde pasa el dinero: tu banco, tu cartera, tu tarjeta de crédito, tu inversión, tu empleador o el concepto "Comida".
- Una **transacción** mueve dinero de una cuenta **origen** a una cuenta **destino** (o afecta solo al origen, como los intereses).

Con esa información el sistema mantiene los saldos al día, distingue lo que es **ingreso**, **gasto** o simple **movimiento interno**, y genera reportes: estado de resultados, gastos por concepto, calendario financiero y progreso contra metas de ahorro.

Características de diseño:

- **Multiusuario**: cada usuario solo ve y modifica sus propios datos. El primer usuario registrado es el único **administrador**.
- **Local**: pensado para correr en una PC de casa con PostgreSQL instalado y, opcionalmente, Docker para la versión "productiva".
- **Bilingüe**: interfaz en **español** (por defecto) e **inglés**, con cambio de idioma en caliente.
- **Seguro con el dinero**: los montos nunca usan números de punto flotante y **ninguna cuenta puede quedar con saldo negativo**.

## 2. ¿Qué hace?

- Registro e inicio de sesión de usuarios (JWT).
- Administración de **cuentas** con jerarquía (cuentas y sub-cuentas), ícono, color, moneda ilustrativa y estado.
- **Tarjetas de crédito / préstamos** con línea de crédito, fecha de corte y fecha límite de pago (calculadas con expresiones *cron* y actualizadas automáticamente).
- Captura de **transacciones por lotes**: se arman varias transacciones en un borrador local, el sistema recalcula los saldos en vivo, se revisa un resumen y se guarda todo de una sola vez.
- **Transacciones aplicadas por lado**: se indica si el monto ya se reflejó en el origen y en el destino (dinero en tránsito, retiros solicitados, cargos por reflejarse); el lado pendiente se "aplica" después.
- **Transacciones programadas** (recurrentes) con expresión *cron*: renta, internet, nómina, etc.
- **Home** con dos pestañas:
  - **Resumen**: gráfica de ingresos/egresos/neto, gastos por concepto del mes, tarjetas de cuentas en uso, árbol de cuentas agrupadas y progreso de la meta anual de ahorro.
  - **Calendario**: ingresos y egresos por día, fechas de corte/pago de tarjetas y próximas transacciones programadas.
- **Metas anuales** de ahorro con semáforo mensual y anual.
- **Administración** (solo ADMIN): usuarios y catálogo de monedas.

## 3. Stack tecnológico

| Capa | Tecnologías |
|---|---|
| Backend | Java 21, Spring Boot 4.1.1 (Spring Framework 7, Hibernate 7, Jackson 3), Maven Wrapper, Spring Web MVC, Spring Data JPA, Spring Security + JWT (`jjwt`), Bean Validation, Actuator (solo `health`), `@Scheduled`, Flyway, Lombok, MapStruct, springdoc-openapi, Spotless |
| Base de datos | PostgreSQL (instalado en el equipo, fuera de Docker) |
| Frontend | Angular 21 (standalone, signals, control flow), PrimeNG 21 (tema Aura, primary `noir`, surface `slate`, modo oscuro), Tailwind CSS + `tailwindcss-primeui`, PrimeIcons, `p-chart` (Chart.js), `@ngx-translate`, `date-fns`, ESLint + Prettier |
| Infraestructura | Docker + Docker Compose: NGINX (sirve el SPA y hace *reverse proxy*) + Spring Boot |
| Pruebas | JUnit 5, AssertJ, Mockito, Spring Boot Test (backend); Vitest (frontend). Casos compartidos en `docs/transaction-cases.json` |

## 4. Estructura del repositorio

```
accountant/
├── backend/                  # API REST — Spring Boot (Maven)
│   └── src/main/java/com/devs/accountant/
│       ├── shared/           # config, seguridad, errores (ProblemDetail), paginado/filtros, CurrentUser, zona horaria
│       ├── auth/             # sign-in, sign-up, JWT
│       ├── user/             # administración de usuarios
│       ├── currency/         # catálogo de monedas
│       ├── account/          # cuentas + jerarquía
│       ├── credit/           # líneas de crédito (DEBTOR) + job de fechas
│       ├── transaction/      # transacciones + motor de reglas (engine/)
│       ├── schedule/         # transacciones programadas
│       ├── goal/             # metas anuales
│       ├── dashboard/        # reportes del home
│       └── calendar/         # vista calendario
├── frontend/                 # SPA — Angular + PrimeNG
│   └── src/app/
│       ├── core/             # auth, layout, manejo de errores, i18n, tema
│       ├── shared/           # componentes, enums, modelos, pipes, utilidades de dinero
│       └── features/         # auth, home, accounts, transactions, schedules, admin
├── docker/                   # Dockerfiles y configuración de NGINX (fase 9)
├── docs/
│   ├── PROMPT-accountant-v2.md   # especificación completa del sistema
│   ├── business-rules.md         # reglas del motor de transacciones (prosa + tablas)
│   └── transaction-cases.json    # casos de prueba compartidos back/front
├── docker-compose.yml        # (fase 9)
├── .env.example              # (fase 9)
├── .gitignore                # único .gitignore para todo el monorepo
└── README.md
```

Cada *feature* del backend sigue el mismo patrón: `XxxController`, `XxxService` + `XxxServiceImpl`, `XxxRepository`, entidad `Xxx`, `dto/` (`XxxRequest`, `XxxResponse`, `XxxFilter`) y `XxxMapper` (MapStruct).

## 5. Configuración

### 5.1 Generales

| Concepto | Valor |
|---|---|
| Context path del backend | `/accountant` (todos los endpoints cuelgan de ahí, p. ej. `/accountant/accounts`) |
| URL del API en el frontend | `environment.apiUrl = '/accountant'` |
| Zona horaria | `America/Mexico_City` (JVM, Hibernate `jdbc.time_zone` y formateo en el front) |
| Dinero | `BigDecimal` / `NUMERIC(19,2)` en backend; **centavos enteros** en frontend |
| Esquema de BD | Gestionado por **Flyway** (`ddl-auto=validate`) |

### 5.2 Perfiles

| Perfil | Uso | Detalles |
|---|---|---|
| `dev` (por defecto) | Desarrollo local | Puerto 8080, BD `accountant_dev`, CORS solo `http://localhost:4200`, Swagger UI habilitado, semilla de datos de prueba (`db/seed-dev`), logs SQL activables |
| `prod` | Docker "producción local" | BD `accountant` en el host, Swagger deshabilitado, sin CORS (mismo origen vía NGINX) |

### 5.3 Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `DB_URL` | JDBC de PostgreSQL | dev: `jdbc:postgresql://localhost:5432/accountant_dev` · prod: `jdbc:postgresql://host.docker.internal:5432/accountant` |
| `DB_USERNAME` / `DB_PASSWORD` | Credenciales de la BD | solo en `application-dev.yml` hay valores por defecto |
| `JWT_SECRET` | Secreto HS256 (mínimo 256 bits) | solo en dev |
| `JWT_EXPIRATION_MINUTES` | Vigencia del token | `240` (4 h) |
| `APP_PORT` | Puerto del host expuesto por NGINX (Docker) | `8085` |

En Docker las variables se leen de un archivo `.env` (no versionado) basado en `.env.example`. **Nunca** se versionan contraseñas reales.

## 6. Cómo levantar el proyecto

### 6.1 Prerrequisitos

- **Java 21** (JDK). `JAVA_HOME` debe apuntar al JDK 21 (Maven Wrapper lo usa); con Java 8 el build falla.
- **Node.js** `^20.19 || ^22.12 || >=24` + npm (probado con Node 24)
- **PostgreSQL** instalado localmente y en ejecución (probado con PostgreSQL 18)
- (Opcional) **Docker Desktop** para la versión productiva local

### 6.2 Base de datos

```sql
CREATE DATABASE accountant_dev;   -- desarrollo
CREATE DATABASE accountant;       -- producción local (Docker)
```

Flyway crea las tablas al arrancar el backend (`V1__init_schema.sql`, `V2__seed_currencies.sql` y, en dev, `db/seed-dev/R__dev_seed.sql` con un usuario y cuentas de ejemplo).

**Usuario de prueba (solo perfil `dev`):** `demo` / `demo12345`. Tiene rol USER, así que el primer usuario que se registre sigue siendo el administrador. Incluye una cuenta de cada tipo, una tarjeta (Por pagar) con línea de crédito y una inversión temporal. La semilla no hace nada si el usuario `demo` ya existe.

En dev, si no defines variables, el backend usa `postgres`/`postgres` en `localhost:5432/accountant_dev`. Para otras credenciales copia `backend/application-local.yml.example` a `backend/application-local.yml` (ignorado por git) o exporta `DB_USERNAME` y `DB_PASSWORD` (y opcionalmente `DB_URL`, `JWT_SECRET`, `SHOW_SQL=true`).

### 6.3 Desarrollo

Backend (puerto 8080, perfil `dev`):

```bash
cd backend
./mvnw spring-boot:run
```

En Windows (PowerShell/CMD) usar `mvnw.cmd spring-boot:run`. Swagger UI queda disponible en `http://localhost:8080/accountant/swagger-ui.html`.

Frontend (puerto 4200, con *proxy* `/accountant` → `http://localhost:8080`):

```bash
cd frontend
npm install
npm start
```

Abrir `http://localhost:4200`. El **primer usuario** que se registre será el administrador.

Pruebas, formato y lint del backend (`verify` falla si el código no cumple el formato de Spotless; `spotless:apply` lo corrige):

```bash
cd backend
./mvnw verify
```

```bash
cd backend
./mvnw spotless:apply
```

Pruebas, lint y formato del frontend (Vitest, ESLint con `angular-eslint`, Prettier):

```bash
cd frontend
npm test
```

```bash
cd frontend
npm run lint
```

```bash
cd frontend
npm run format
```

### 6.4 "Producción" local con Docker

```bash
cp .env.example .env
docker compose up -d --build
```

- `frontend`: imagen multi-stage (node → `ng build` → `nginx:alpine`). NGINX sirve el SPA y redirige `/accountant/` al backend.
- `backend`: imagen multi-stage (`maven:3-eclipse-temurin-21` → `eclipse-temurin:21-jre`) con perfil `prod`. **No expone puertos al host**.
- **Solo NGINX expone puerto**: `http://localhost:${APP_PORT:-8085}`.
- El backend se conecta al PostgreSQL del equipo vía `host.docker.internal`. Para permitirlo:
  - `postgresql.conf`: `listen_addresses = '*'` (o la IP de la interfaz de Docker).
  - `pg_hba.conf`: agregar una línea para la red de Docker, p. ej. `host accountant all 172.16.0.0/12 scram-sha-256`.
  - Reiniciar el servicio de PostgreSQL.

## 7. Cómo funciona el sistema (conceptos clave)

| Concepto | Significado |
|---|---|
| **Saldo (`balance`)** | Dinero que hay en la cuenta (o, en DEBTOR, lo que debes; en CREDITOR, lo que te deben). Solo existe en tipos "con saldo". **Nunca puede ser negativo.** |
| **Monto (`A`)** | Cantidad principal de la transacción. Siempre > 0. |
| **Fee (`F`)** | Comisión, retención o cargo asociado. ≥ 0. Algunos tipos no lo permiten. |
| **Tipo de operación** | `ADDITION` (ingreso), `SUBTRACTION` (gasto) o `NEUTER` (movimiento interno: solo su comisión cuenta como gasto). |
| **Monto para reportes** | Se calcula al consultar, no se guarda: ingreso `A − F`, gasto `A + F`; de un movimiento interno solo cuenta `F` como gasto. |
| **Aplicada (`applied`)** | Indica si el efecto pendiente ya se reflejó. Una transacción pendiente no cambia ese saldo hasta que se aplica; `applied_at` guarda cuándo se aplicó. |
| **Lote** | Conjunto de transacciones capturadas y guardadas juntas, de forma atómica. |

Principios:

1. **El gasto se reconoce cuando consumes.** Una compra con tarjeta (EXPENSE Visa → Comida o DEBT Visa → Comida) es gasto el día de la compra; el pago de la tarjeta (PAYMENT) y un préstamo en efectivo (DEBT → Almacén) son movimientos internos, así no se cuenta el gasto dos veces.
2. **Los saldos solo suman y restan montos.** No hay acumulados auxiliares: cada transacción suma o resta su monto (y comisión) en las cuentas; el efecto pendiente, solo al aplicarse.
3. **Las transacciones guardadas no se editan ni se anulan.** El control está antes de guardar: el editor de lotes y su resumen.
4. **No se reescribe el historial.** La fecha de una transacción no puede ser anterior a la última transacción guardada de las cuentas involucradas.
5. **El backend es la fuente de verdad.** El frontend replica el cálculo solo para dar retroalimentación inmediata; el backend siempre vuelve a validar.
6. **Los reportes usan la fecha de aplicación (`applied_at`)**. Lo pendiente no cuenta todavía.

## 8. Tipos de cuenta

| Tipo | Qué representa | Ejemplos | ¿Saldo? | Sub-cuentas permitidas |
|---|---|---|---|---|
| `GROUP` | Agrupador para organizar. Nunca participa en transacciones. | "Bancos", "Familia" | No | Cualquier tipo |
| `SUPPLIER` | Fuente de ingresos. | Empleador, cliente | No | SUPPLIER |
| `STORAGE` | Donde guardas dinero disponible. | Cuenta bancaria, efectivo, monedero | Sí | STORAGE, INVESTMENT, DEBTOR |
| `CONSUMER` | Concepto de gasto. | Comida, casa, transporte | No | CONSUMER |
| `BUSINESS` | Negocio propio. | Tienda, freelance | Sí | STORAGE, INVESTMENT |
| `INVESTMENT` | Inversión. | CETES, fondo, plazo fijo | Sí | INVESTMENT |
| `CREDITOR` | Cuenta por cobrar: dinero que **tú prestaste**. Saldo = lo que te deben. | Préstamo a un amigo | Sí | CREDITOR |
| `DEBTOR` | Cuenta por pagar: dinero que **tú debes**. Saldo = deuda. Puede tener línea de crédito. | Tarjeta de crédito, préstamo personal | Sí | DEBTOR |

Reglas de cuentas:

- **Saldo**: GROUP, SUPPLIER y CONSUMER no tienen saldo. Los demás, saldo ≥ 0.
- **Nombre único** por usuario y tipo.
- **Jerarquía**: el padre debe aceptar el tipo hijo (tabla anterior) y **no se permiten ciclos** (una cuenta no puede colgar de sí misma ni de ningún descendiente).
- **Cambio de tipo**: libre si la cuenta no tiene sub-cuentas ni transacciones; si las tiene, solo entre **STORAGE e INVESTMENT**. Además, el nuevo tipo debe aceptar las sub-cuentas existentes, una cuenta con línea de crédito debe seguir siendo DEBTOR y, para cambiar a un tipo sin saldo, el saldo debe ser 0.
- **Actualización**: al editar una cuenta solo se modifican los datos enviados; el resto se conserva y el identificador nunca cambia.
- **Edición manual de saldo**: se puede corregir el saldo desde el formulario; se sobrescribe directamente **sin generar transacción** (útil para ajustes o saldo inicial).
- **Estados**: `ACTIVE`, `DISABLED` (no usable, reactivable) y `DELETED` (borrado lógico; solo si el saldo es 0 y no tiene sub-cuentas activas).
- **Incluir en balance**: decide si la cuenta suma en las tarjetas y totales del home.
- **Cuentas temporales** (solo INVESTMENT y BUSINESS): al aplicarse un `PROFIT` que sale de ella, la cuenta se **deshabilita automáticamente** (la inversión terminó), aunque quede saldo remanente. Se puede reactivar manualmente.
- **Moneda**: es **ilustrativa** (se muestra junto al saldo). No hay conversión ni validación de monedas entre cuentas.

### 8.1 Crédito (solo DEBTOR)

Una cuenta DEBTOR puede tener asociada una **línea de crédito**:

- **Límite de crédito**: ninguna compra, disposición o interés puede hacer que la deuda supere el límite (`CREDIT_LIMIT_EXCEEDED`).
- **Fecha de corte** y **fecha límite de pago**: se definen con expresiones *cron*. El formulario ofrece un modo simple ("día N de cada mes" / "último día del mes") y un modo avanzado, y muestra las próximas 3 fechas.
- El sistema guarda la **próxima** fecha de corte y de pago y las avanza solo con un job diario (00:05) y al arrancar la aplicación.
- Datos derivados: **crédito disponible** = límite − saldo, y **porcentaje de uso**.

## 9. Tipos de transacción

Notación: `A` = monto, `F` = fee (comisión o impuesto). El detalle completo está en [`docs/business-rules.md`](docs/business-rules.md).

### 9.1 Cuentas permitidas por tipo

| Tipo | Significado | Origen | Destino |
|---|---|---|---|
| `INCOME` | Ingreso (sueldo, cobro a cliente) | SUPPLIER | STORAGE (obligatorio) |
| `EXPENSE` | Gasto, con dinero propio o con tarjeta | STORAGE, DEBTOR | CONSUMER (obligatorio) |
| `TRANSFER` | Mover dinero entre cuentas propias | STORAGE | STORAGE (obligatorio) |
| `INVEST` | Invertir | STORAGE, INVESTMENT | INVESTMENT, BUSINESS (obligatorio) |
| `PROFIT` | Retirar los recursos de una inversión o negocio | INVESTMENT, BUSINESS | STORAGE, INVESTMENT (obligatorio) |
| `DIVIDEND` | Rendimiento: la inversión te da dinero | INVESTMENT, BUSINESS, STORAGE, CREDITOR | Las mismas (opcional) |
| `INTEREST` | Interés o cargo en contra | INVESTMENT, BUSINESS, STORAGE, DEBTOR | — (prohibido) |
| `BORROW` | Prestar dinero a alguien | STORAGE | CREDITOR (obligatorio) |
| `COLLECTION` | Cobrar un préstamo que hiciste | CREDITOR | STORAGE (obligatorio) |
| `DEBT` | Endeudarte: préstamo en efectivo o compra a crédito | DEBTOR | STORAGE o CONSUMER (obligatorio) |
| `PAYMENT` | Pagar una deuda | STORAGE | DEBTOR (obligatorio) |

Siempre: origen ≠ destino, ambas cuentas activas y del usuario.

### 9.2 Efecto sobre los saldos

*(pendiente)* = ese efecto solo ocurre cuando la transacción está aplicada.

| Tipo | Validaciones | Origen | Destino |
|---|---|---|---|
| INCOME | `F < A` | — (sin saldo) | `+ (A − F)` |
| EXPENSE desde STORAGE | fondos ≥ `A + F` | `− (A + F)` *(pendiente)* | — (sin saldo) |
| EXPENSE desde DEBTOR | límite de crédito | `+ (A + F)` *(pendiente)* | — (sin saldo) |
| TRANSFER / INVEST / PROFIT | fondos ≥ `A`; `F < A` | `− A` (inmediato) | `+ (A − F)` *(pendiente)* |
| DIVIDEND | `F < A` | sin destino: `+ (A − F)` | con destino: `+ (A − F)` |
| INTEREST (no DEBTOR) | fondos ≥ `A`; sin fee | `− A` | — |
| INTEREST (DEBTOR) | límite de crédito; sin fee | `+ A` la deuda crece | — |
| BORROW | fondos ≥ `A`; sin fee | `− A` | `+ A` |
| COLLECTION | `A` ≤ lo que te deben; sin fee | `− A` | `+ A` |
| DEBT → STORAGE | límite de crédito; `F < A` | `+ A` | `+ (A − F)` |
| DEBT → CONSUMER | límite de crédito; sin fee | `+ A` | — (sin saldo) |
| PAYMENT | fondos ≥ `A + F`; `A` ≤ deuda | `− (A + F)` | `− A` |

### 9.3 Transacciones pendientes

Cada transacción tiene un solo indicador **aplicada** (por defecto sí). Solo pueden quedar pendientes:

| Tipo | Queda pendiente | Se aplica de inmediato |
|---|---|---|
| EXPENSE (desde STORAGE o DEBTOR) | el cargo al origen | — |
| TRANSFER, INVEST, PROFIT | el abono al destino | el cargo al origen |
| Los demás (incluido PAYMENT) | — | todo |

Ejemplo: un retiro de una SOFIPO se solicita hoy y se refleja horas después. Se registra un PROFIT pendiente: el origen se descuenta en ese momento y el destino no cambia; cuando el dinero llega, **Aplicar** suma en el destino. Los fondos o el límite de crédito del efecto pendiente se validan al aplicarlo.

### 9.4 ¿Cuenta como ingreso o gasto?

| Tipo / variante | Tipo de operación | Cuenta en reportes |
|---|---|---|
| INCOME, DIVIDEND | ADDITION | ingreso `A − F` |
| EXPENSE (desde STORAGE o DEBTOR), INTEREST, DEBT → CONSUMER | SUBTRACTION | gasto `A + F` |
| DEBT → STORAGE, PAYMENT, TRANSFER, INVEST, PROFIT, BORROW, COLLECTION | NEUTER | solo `F` como gasto |

Las comisiones de las NEUTER aparecen en un concepto "Comisiones" que solo existe en el reporte (no hay cuenta en la base de datos). Todo cuenta en la fecha `applied_at`.

| Escenario | Transacciones | Ingreso | Gasto | Neto |
|---|---|---|---|---|
| Préstamo en efectivo usado y pagado | DEBT → STORAGE 10,000 → EXPENSE 10,000 → PAYMENT 10,000 | 0 | 10,000 | −10,000 |
| Préstamo en efectivo devuelto sin usar | DEBT → STORAGE 10,000 → PAYMENT 10,000 | 0 | 0 | 0 |
| Compra con TDC y pago | EXPENSE Visa → Comida 10,000 → PAYMENT 10,000 | 0 | 10,000 | −10,000 |
| Compra a crédito y pago | DEBT Visa → Comida 10,000 → PAYMENT 10,000 | 0 | 10,000 | −10,000 |
| Interés de la TDC y pago | INTEREST Visa 500 → PAYMENT 500 | 0 | 500 | −500 |
| Pago con comisión | PAYMENT 10,000 con comisión 50 | 0 | 50 | −50 |

### 9.5 Aplicar transacciones pendientes

`PATCH /transactions/{id}/apply` aplica el efecto pendiente: valida fondos o límite de crédito, guarda `applied_at` y sobrescribe los saldos antes/después de la cuenta afectada con los de ese momento. Un PROFIT de una cuenta temporal la deshabilita al aplicarse. Aplicar dos veces no tiene efecto.

### 9.6 Errores de negocio

| Código | Cuándo ocurre |
|---|---|
| `INSUFFICIENT_FUNDS` | El origen no tiene saldo suficiente |
| `CREDIT_LIMIT_EXCEEDED` | La deuda superaría el límite de crédito |
| `SENSELESS_TRANSACTION` | Pagar más de lo que se debe o cobrar más de lo que te deben |
| `DATE_BEFORE_LAST_TRANSACTION` | La fecha es anterior a la última transacción guardada de alguna cuenta |
| `ACCOUNT_DISABLED` | Se usa una cuenta deshabilitada (p. ej. temporal tras su PROFIT) |
| `ACCOUNT_NOT_DELETABLE` | Borrar una cuenta con saldo o con sub-cuentas |
| `TRANSACTION_NOT_SUPPORTED` | Aplicar una transacción cuyo tipo no admite pendiente |
| `CONFLICT` | Una cuenta cambió mientras se guardaba el lote |

## 10. Motor de cálculo y editor de lotes

El corazón de la aplicación es el **editor de lotes**:

1. Al abrirlo se cargan las reglas (`GET /transactions/rules`), las cuentas usables con su saldo actual y las transacciones programadas aplicables.
2. Cada transacción que agregas, editas o eliminas **recalcula todo el lote desde cero**: se parte de los saldos reales, se ordena por fecha y se aplica una por una. Si alguna falla, el cambio se rechaza y se indica cuál falló y por qué.
3. El formulario muestra una **vista previa en vivo** del saldo de origen y destino antes y después, el crédito disponible en tarjetas, y resalta en rojo los resultados inválidos.
4. El borrador se guarda en el navegador (`localStorage`), así que sobrevive a recargas. Si los saldos reales cambiaron mientras tanto, se avisa y se recalcula.
   El motor del navegador no duplica la matriz de reglas: la recibe de `GET /transactions/rules`. Sus pruebas usan [`docs/transaction-rules.json`](docs/transaction-rules.json), una copia de ese endpoint que una prueba del backend mantiene idéntica (se regenera con `./mvnw test -Dtest=TransactionServiceImplTest -Drules.fixture.update=true`).
5. **Revisar** abre un resumen: cuentas afectadas (saldo actual → proyectado), totales de ingresos/gastos/neto, transacciones pendientes, cuentas temporales que se deshabilitarán y programadas incluidas.
6. **Guardar** (solo desde el resumen) envía el lote a `POST /transactions/batch`. El backend lo procesa en **una sola transacción de base de datos** con bloqueo de cuentas: o se guardan todas, o ninguna.

### 10.1 Transacciones programadas

- Tienen tipo, cuentas, monto, fee, descripción y una expresión *cron* (6 campos de Spring), p. ej. `0 0 0 1 * *` = día 1 de cada mes.
- Siguen **exactamente las mismas reglas** que las transacciones normales.
- Las que vencen hasta mañana aparecen como **aplicables** en el editor de lotes; "Aplicar" precarga el formulario. Al guardarse, la programada avanza a su siguiente ejecución.
- Se pueden activar/desactivar, **saltar** una ejecución, editar o borrar (borrado lógico). Sin "próxima ejecución" explícita, se usa la primera ocurrencia del *cron* desde hoy (hoy incluido); al cambiar el *cron* se recalcula.
- Sus próximas ocurrencias se muestran en el calendario.

## 11. Opciones del sistema (pantallas)

| Pantalla | Qué ofrece |
|---|---|
| **Sign-in / Sign-up** | Registro e inicio de sesión. El primer registro es ADMIN. |
| **Home › Resumen** | Gráfica de **estado de resultados** (ingresos, egresos y neto por año/mes/semana/día con ventana ajustable); **dona de gastos por concepto** por mes; **tarjetas de cuentas en uso** con total general y uso de crédito; **árbol de cuentas agrupadas** con porcentajes; **progreso anual vs meta** con semáforo por mes y por año. |
| **Home › Calendario** | Vista mensual (semana inicia en lunes) con ingresos (verde) y egresos (rojo) por día, fechas de corte y de pago de tarjetas, y programadas futuras. Al dar clic en un día se ve el detalle. |
| **Cuentas** | Listado con filtros, orden y paginado (el estado se refleja en la URL). Formulario de alta/edición con sección de crédito para DEBTOR. Detalle con datos, crédito, sub-cuentas y últimas transacciones. |
| **Transacciones** | Listado con filtros (tipo, cuenta, fechas, montos, aplicada, lote…), acción "aplicar" en pendientes y botón **Nuevo lote**. |
| **Programadas** | Listado y formulario con verificador de *cron* y próximas ejecuciones. |
| **Metas** | Se administran desde el widget de progreso del home (una meta por año). |
| **Admin** (solo ADMIN) | Usuarios (habilitar/deshabilitar) y catálogo de monedas. |
| **Barra superior** | Idioma (ES/EN), modo claro/oscuro y menú de usuario. |

## 12. Flujos de uso

### 12.1 Primeros pasos

1. Regístrate (si eres el primero, serás ADMIN) e inicia sesión.
2. Crea tus cuentas (ver 12.2). Te recomendamos empezar por:
   - **GROUP** opcionales para organizar ("Bancos", "Inversiones", "Gastos").
   - **SUPPLIER** para cada fuente de ingreso (tu empleador).
   - **STORAGE** para cada banco y el efectivo, con su **saldo actual** como saldo inicial.
   - **CONSUMER** para tus conceptos de gasto (Comida, Casa, Transporte, Servicios…).
   - **DEBTOR** para cada tarjeta o préstamo, con su deuda actual y línea de crédito.
   - **INVESTMENT / BUSINESS / CREDITOR** si aplican.
3. A partir de ahí, registra tus movimientos con el editor de lotes (ver 12.3).

### 12.2 Agregar una cuenta

1. Menú **Cuentas** → **Nueva cuenta** (o la tarjeta "Nueva cuenta" del home).
2. Captura **nombre** y **tipo**.
3. (Opcional) Elige una **cuenta padre**: solo aparecen las que aceptan ese tipo y no generan ciclos.
4. Elige la **moneda** (ilustrativa), **ícono** y **color**.
5. Si el tipo tiene saldo, captura el **saldo inicial**.
6. Marca **Incluir en balance** si debe sumar en el home, y **Temporal** si es una inversión/negocio que se cerrará con su PROFIT.
7. Si es DEBTOR con tarjeta/préstamo, llena la sección **Crédito**: límite, día de corte y día de pago (modo simple o *cron*); verifica las próximas fechas mostradas.
8. Guarda. La cuenta aparece en el listado y, si tiene saldo > 0 y está incluida en el balance, en las tarjetas del home.

### 12.3 Agregar transacciones

1. Menú **Transacciones** → **Nuevo lote**.
2. En el formulario:
   1. Elige el **tipo** de transacción.
   2. Elige **origen** y **destino**: los selectores solo muestran cuentas válidas para ese tipo, con su saldo proyectado.
   3. Captura **monto** y, si aplica, **fee** (o usa "usar saldo total").
   4. Elige la **fecha** (no puede ser anterior a la última transacción guardada de esas cuentas).
   5. Si el tipo lo permite (EXPENSE, TRANSFER, INVEST, PROFIT), indica si el movimiento **ya se reflejó** o queda pendiente.
   6. La **descripción** se autogenera ("Gasto Banco → Comida"); puedes editarla.
   7. Revisa la vista previa de saldos antes → después y presiona **Agregar**.
3. Repite para todas las transacciones del lote. La tabla muestra cada una con sus saldos antes/después y su tipo de operación. Puedes editar o eliminar cualquiera; todo se recalcula.
4. (Opcional) Desde el panel de **programadas aplicables**, usa **Aplicar** para agregar una recurrente.
5. Presiona **Revisar**, verifica cuentas afectadas, totales y avisos.
6. Presiona **Guardar**. Si todo es válido, el lote se guarda completo y el borrador se limpia; si algo falla, no se guarda nada y se indica qué transacción falló.
7. Para transacciones **pendientes**, usa **Aplicar** en el listado de transacciones o en el detalle de la cuenta cuando el movimiento se refleje.

Ejemplos rápidos:

| Quiero registrar… | Tipo | Origen → Destino |
|---|---|---|
| Me pagaron la quincena | INCOME | Empleador → Banco |
| Pagué el súper con débito | EXPENSE | Banco → Comida |
| Pagué el súper con tarjeta de crédito | EXPENSE (o DEBT) | Visa → Comida |
| Pagué la tarjeta | PAYMENT | Banco → Visa |
| Retiré efectivo del cajero | TRANSFER | Banco → Efectivo |
| Metí dinero a CETES | INVEST | Banco → CETES |
| Me dieron rendimientos | DIVIDEND | CETES (→ Banco opcional) |
| Retiré mi inversión | PROFIT | CETES → Banco |
| Me cobraron comisión bancaria | INTEREST | Banco |
| Le presté a un amigo / me pagó | BORROW / COLLECTION | Banco → Préstamo Juan / Préstamo Juan → Banco |
| Saqué un préstamo personal | DEBT | Préstamo → Banco |

## 13. API REST (resumen)

Todas las rutas son relativas a `/accountant`, en JSON, y requieren `Authorization: Bearer <jwt>` excepto `/auth/**` y `/actuator/health`. Los listados son paginados (`page`, `size`, `sort`, filtros) y los errores siguen `ProblemDetail` (RFC 7807) con un `code`.

```
POST   /auth/sign-in | /auth/sign-up
GET    /accounts | /accounts/options | /accounts/in-use | /accounts/{id} | /accounts/{id}/transactions
POST   /accounts      PUT/DELETE /accounts/{id}      PUT/DELETE /accounts/{id}/credit
GET    /transactions | /transactions/{id} | /transactions/rules
POST   /transactions/batch       PATCH /transactions/{id}/apply
GET    /schedules | /schedules/applicable | /schedules/{id} | /schedules/cron/check
POST   /schedules     PUT /schedules/{id}     PATCH /schedules/{id}/status | /schedules/{id}/skip     DELETE /schedules/{id}
GET    /goals         PUT/DELETE /goals/{year}
GET    /dashboard/income-statement | /dashboard/expenses-by-concept | /dashboard/summary | /dashboard/progress
GET    /calendar?from=&to=
GET    /currencies/options
       /admin/users/**  /admin/currencies/**   (solo ADMIN)
PATCH  /me/language
```

La documentación interactiva está en Swagger UI (solo perfil `dev`).

## 14. Hoja de ruta (fases)

1. **Andamiaje**: Maven + Angular + PrimeNG + Tailwind + i18n + layout, perfiles dev/prod, Flyway V1, proxy dev, Spotless/ESLint/Prettier.
2. **Auth + admin** + paginado/filtros genéricos y tabla *lazy* sincronizada con la URL.
3. **Cuentas + crédito**.
4. **Motor de transacciones backend** + `docs/transaction-cases.json`.
5. **Editor de lotes frontend** + listado de transacciones.
6. **Programadas**.
7. **Home – Resumen**.
8. **Home – Calendario**.
9. **Docker prod-local** y verificación end-to-end.

La especificación detallada de cada punto está en [`docs/PROMPT-accountant-v2.md`](docs/PROMPT-accountant-v2.md).
