# Accountant — documentación técnica

Este documento describe cómo está construido Accountant, cómo se ejecuta y cómo se despliega. El uso del sistema está en el [README](../README.md).

Accountant es una reconstrucción de un sistema de finanzas personales anterior (que no forma parte de este repositorio): una aplicación web multiusuario con backend Spring Boot, frontend Angular y PostgreSQL, pensada para correr en un equipo de casa.

---

## Contenido

1. [Arquitectura](#1-arquitectura)
2. [Tecnologías](#2-tecnologías)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Configuración](#4-configuración)
5. [Desarrollo local](#5-desarrollo-local)
6. [Despliegue con Docker](#6-despliegue-con-docker)
7. [Base de datos](#7-base-de-datos)
8. [Backend](#8-backend)
9. [Motor de transacciones](#9-motor-de-transacciones)
10. [Reportes y calendario](#10-reportes-y-calendario)
11. [Frontend](#11-frontend)
12. [API REST](#12-api-rest)
13. [Pruebas y calidad](#13-pruebas-y-calidad)
14. [Decisiones de diseño](#14-decisiones-de-diseño)

---

## 1. Arquitectura

```
Navegador ──HTTP──▶ NGINX (puerto 8085) ──/accountant/──▶ Spring Boot (8080, red interna) ──JDBC──▶ PostgreSQL (equipo host)
                      │
                      └── sirve el build de Angular (SPA)
```

- **Frontend:** SPA de Angular. En producción la sirve NGINX; en desarrollo, `ng serve` con un *proxy* de `/accountant` al backend.
- **Backend:** API REST JSON con context path `/accountant`, autenticación JWT sin estado y errores en formato `ProblemDetail` (RFC 7807).
- **Base de datos:** PostgreSQL instalado en el equipo (fuera de Docker). El esquema lo gestiona Flyway.
- **Fuente de verdad:** el backend valida y calcula todo. El frontend replica el cálculo de saldos solo para dar retroalimentación inmediata en el editor de lotes.

## 2. Tecnologías

| Capa | Tecnologías |
|---|---|
| Backend | Java 21, Spring Boot 4.1 (Spring Framework 7, Hibernate 7, Jackson 3), Maven Wrapper, Spring Web MVC, Spring Data JPA, `JdbcClient` para reportes, Spring Security + JWT (`jjwt` 0.13), Bean Validation, Actuator (solo `health`), `@Scheduled`, Flyway, Lombok, MapStruct 1.6, springdoc-openapi, Spotless (palantir-java-format) |
| Base de datos | PostgreSQL (probado con la versión 18) |
| Frontend | Angular 21 (componentes *standalone*, *signals*, nuevo *control flow*), PrimeNG 21 (tema Aura, primario `noir`, superficie `slate`, modo oscuro), Tailwind CSS 4 + `tailwindcss-primeui`, PrimeIcons, Chart.js (`p-chart`), `@ngx-translate`, `date-fns`, ESLint (`angular-eslint`) + Prettier |
| Infraestructura | Docker + Docker Compose: NGINX (sirve el SPA y hace *reverse proxy*) + Spring Boot |
| Pruebas | JUnit 5, AssertJ, Mockito, Spring Boot Test (backend); Vitest con el *builder* de pruebas de Angular (frontend) |

Se usa PrimeNG 21 (licencia MIT) con Angular 21; PrimeNG 22 requiere licencia comercial.

## 3. Estructura del repositorio

```
accountant/
├── backend/                     # API REST — Spring Boot (Maven)
│   ├── src/main/java/com/devs/accountant/
│   │   ├── shared/              # configuración, seguridad (JWT, CurrentUser), errores, paginado/filtros, auditoría
│   │   ├── auth/                # sign-in, sign-up, emisión de JWT
│   │   ├── user/                # administración de usuarios y preferencias (/me)
│   │   ├── currency/            # catálogo de monedas
│   │   ├── account/             # cuentas y jerarquía
│   │   ├── credit/              # líneas de crédito (DEBTOR) y job de fechas
│   │   ├── transaction/         # transacciones; engine/ = motor de reglas puro
│   │   ├── schedule/            # transacciones programadas y utilidades de cron
│   │   ├── goal/                # metas anuales de ahorro
│   │   ├── dashboard/           # reportes del Inicio
│   │   └── calendar/            # vista de calendario
│   └── src/main/resources/
│       ├── application.yml, application-dev.yml, application-prod.yml
│       └── db/migration/ (V1 esquema, V2 monedas) y db/seed-dev/ (semilla de desarrollo)
├── frontend/                    # SPA — Angular + PrimeNG
│   ├── public/i18n/             # es.json, en.json
│   └── src/app/
│       ├── core/                # auth, layout, manejo de errores HTTP, i18n, tema, almacenamiento local
│       ├── shared/              # componentes, enums, modelos, pipes, dinero, tablas, cron, formularios
│       └── features/            # auth, home, accounts, transactions, schedules, admin
├── docker/                      # Dockerfiles (+ .dockerignore) y configuración de NGINX
├── docs/
│   ├── documentacion-tecnica.md # este documento
│   ├── transaction-cases.json   # casos del motor de transacciones (pruebas backend y frontend)
│   ├── transaction-rules.json   # copia de GET /transactions/rules (pruebas del frontend)
│   └── images/                  # capturas usadas en el README
├── docker-compose.yml           # NGINX + backend (perfil prod)
├── .env.example                 # variables de Docker Compose (sin secretos reales)
├── .gitignore                   # único .gitignore del monorepo
└── README.md                    # guía de uso
```

Cada módulo del backend sigue el mismo patrón: `XxxController`, `XxxService` + `XxxServiceImpl`, `XxxRepository`, entidad `Xxx`, `dto/` (`XxxRequest`, `XxxResponse`, `XxxFilter`) y `XxxMapper` (MapStruct). En el frontend cada *feature* tiene sus páginas, componentes y su servicio de API, con rutas cargadas de forma diferida.

## 4. Configuración

### 4.1 Valores generales

| Concepto | Valor |
|---|---|
| Context path del backend | `/accountant` (p. ej. `/accountant/accounts`) |
| URL del API en el frontend | `environment.apiUrl = '/accountant'` (mismo origen) |
| Zona horaria | `America/Mexico_City` (JVM, Hibernate `jdbc.time_zone`, Jackson y job de crédito) |
| Dinero | `BigDecimal` / `NUMERIC(19,2)` en backend; **centavos enteros** en frontend |
| Esquema de BD | Flyway, con `ddl-auto=validate` |

### 4.2 Perfiles

| Perfil | Uso | Detalles |
|---|---|---|
| `dev` (por defecto) | Desarrollo local | Puerto 8080, BD `accountant_dev`, CORS solo para `http://localhost:4200`, Swagger UI habilitado, semilla de datos de prueba (`db/seed-dev`), logs SQL activables con `SHOW_SQL=true` |
| `prod` | Docker | BD `accountant` en el host, Swagger deshabilitado, sin CORS (mismo origen vía NGINX), sin semilla |

### 4.3 Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `DB_URL` | JDBC de PostgreSQL | dev: `jdbc:postgresql://localhost:5432/accountant_dev` · prod: `jdbc:postgresql://host.docker.internal:5432/accountant` |
| `DB_USERNAME` / `DB_PASSWORD` | Credenciales de la BD | Solo dev tiene valores por defecto (`postgres`/`postgres`) |
| `JWT_SECRET` | Secreto HS256 en base64 (mínimo 256 bits) | Solo dev tiene un secreto de desarrollo |
| `JWT_EXPIRATION_MINUTES` | Vigencia del token | `240` (4 h) |
| `APP_PORT` | Puerto del host que publica NGINX (Docker) | `8085` |

En desarrollo, las credenciales propias van en `backend/application-local.yml` (ignorado por git; ver `application-local.yml.example`) o en variables de entorno. En Docker se leen del archivo `.env` (ignorado por git). **Nunca** se versionan contraseñas reales.

## 5. Desarrollo local

### 5.1 Requisitos

- **Java 21** (JDK), con `JAVA_HOME` apuntando a él (el Maven Wrapper lo usa).
- **Node.js** `^20.19 || ^22.12 || >=24` y npm.
- **PostgreSQL** instalado y en ejecución.
- (Opcional) **Docker Desktop** para el despliegue.

### 5.2 Base de datos

```bash
psql -h localhost -U postgres -c "CREATE DATABASE accountant_dev"
```

Flyway crea las tablas al arrancar. En `dev` también carga `db/seed-dev/R__dev_seed.sql`: el usuario **`demo` / `demo12345`** (rol USER) con una cuenta de cada tipo, una tarjeta con línea de crédito y una inversión temporal. La semilla no hace nada si el usuario `demo` ya existe, y como su rol es USER, el primer usuario que se registre sigue siendo el administrador.

### 5.3 Ejecutar

Backend (puerto 8080, perfil `dev`; en Windows `mvnw.cmd`):

```bash
cd backend
./mvnw spring-boot:run
```

Swagger UI: `http://localhost:8080/accountant/swagger-ui.html`.

Frontend (puerto 4200, *proxy* de `/accountant` a `http://localhost:8080`, ver `frontend/proxy.conf.json`):

```bash
cd frontend
npm install
npm start
```

Abrir `http://localhost:4200`.

### 5.4 Pruebas, formato y lint

```bash
cd backend
./mvnw verify
```

`verify` compila, ejecuta las pruebas y valida el formato con Spotless; `./mvnw spotless:apply` corrige el formato.

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

## 6. Despliegue con Docker

El despliegue local "productivo" usa Docker Compose con dos contenedores; PostgreSQL sigue en el equipo host.

1. Crear la base de datos (Flyway crea las tablas al arrancar; el primer usuario que se registre será el administrador):

   ```bash
   psql -h localhost -U postgres -c "CREATE DATABASE accountant"
   ```

2. Crear el `.env` a partir del ejemplo y llenar `DB_USERNAME`, `DB_PASSWORD` y un `JWT_SECRET` propio (por ejemplo, generado con `openssl rand -base64 32`):

   ```bash
   cp .env.example .env
   ```

3. Construir y levantar (con Docker Desktop en ejecución):

   ```bash
   docker compose up -d --build
   ```

4. Abrir `http://localhost:8085` (o el `APP_PORT` definido).

Operación habitual:

| Acción | Comando |
|---|---|
| Ver logs del backend | `docker compose logs -f backend` |
| Detener sin borrar nada | `docker compose stop` |
| Detener y quitar los contenedores | `docker compose down` |
| Publicar un cambio solo del frontend | `docker compose up -d --build --no-deps frontend` |

Los datos viven en el PostgreSQL del host, así que reconstruir o quitar los contenedores no los borra.

Imágenes (archivos en [`docker/`](../docker)):

- **frontend** ([`frontend.Dockerfile`](../docker/frontend.Dockerfile), contexto: raíz del repositorio): `node:22-alpine` compila Angular en modo producción y `nginx:alpine` sirve el resultado. La configuración de NGINX ([`default.conf`](../docker/nginx/default.conf)) va dentro de la imagen:
  - *fallback* de rutas del SPA a `index.html`;
  - *proxy* de `/accountant/` a `http://backend:8080/accountant/`;
  - caché de un año para los archivos con *hash*, sin caché para `index.html` y las traducciones;
  - gzip y cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) en todas las respuestas.
- **backend** ([`backend.Dockerfile`](../docker/backend.Dockerfile), contexto: `backend/`): `maven:3-eclipse-temurin-21` empaqueta el jar y `eclipse-temurin:21-jre` lo ejecuta con perfil `prod`, usuario sin privilegios y zona horaria `America/Mexico_City`. Las pruebas y Spotless corren en el build normal (`./mvnw verify`), no dentro de la imagen.

Red y seguridad:

- **Solo NGINX publica un puerto** (`${APP_PORT:-8085}:80`); el backend solo se expone en la red interna de Compose.
- El backend llega al PostgreSQL del host por `host.docker.internal` (`extra_hosts: host-gateway`). Con Docker Desktop (Windows/macOS) las conexiones llegan como locales y basta la configuración por defecto de `pg_hba.conf`. En Docker sobre Linux hay que permitir la red de Docker: `listen_addresses = '*'` en `postgresql.conf` y una línea como `host accountant all 172.16.0.0/12 scram-sha-256` en `pg_hba.conf`.
- Los `.dockerignore` (junto a cada Dockerfile) dejan fuera `application-local.yml`, `node_modules` y los builds locales.
- *Health check*: `GET /accountant/actuator/health`.

## 7. Base de datos

Convenciones: tablas `snake_case` en plural, llaves `BIGINT GENERATED ALWAYS AS IDENTITY`, llaves foráneas `<entidad>_id`, enums como `VARCHAR` + `CHECK`, dinero `NUMERIC(19,2)` y fechas `TIMESTAMP` en hora de `America/Mexico_City`. Todo registro de negocio pertenece a un `user_id` y toda consulta filtra por el usuario autenticado.

| Tabla | Contenido | Restricciones relevantes |
|---|---|---|
| `users` | Usuarios: nombre, usuario, contraseña (BCrypt), rol, estado, idioma preferido | Usuario único; índice único parcial que permite **un solo ADMIN** |
| `currencies` | Catálogo de monedas (V2 carga MXN y USD) | Nombre e ISO únicos, ISO de 3 letras |
| `accounts` | Cuentas: tipo, padre, saldo, ícono, color, incluir en balance, temporal, estado, `version` | Saldo `NULL` para GROUP/SUPPLIER/CONSUMER y `≥ 0` para el resto; temporal solo INVESTMENT/BUSINESS; color `#RRGGBB`; nombre único por (usuario, nombre, tipo) entre no eliminadas |
| `credits` | Línea de crédito 1:1 con una cuenta DEBTOR: límite, crons de corte y pago, próximas fechas | Límite `> 0` |
| `schedules` | Transacciones programadas: tipo, cuentas, monto, comisión, cron, próxima y última ejecución, estado | Monto `> 0`, comisión `≥ 0`, cuentas distintas |
| `transactions` | Transacciones guardadas: tipo, `operation_type`, cuentas, monto, comisión, descripción, saldos antes/después, `applied`, `operation_date`, `applied_at`, `batch_uuid`, `schedule_id` | `uuid` único; `applied_at` obligatorio si y solo si `applied`; saldos guardados `≥ 0` |
| `goals` | Meta anual de ahorro por usuario | Único (usuario, año), meta `> 0` |

Migraciones:

- `V1__init_schema.sql`: esquema completo, índices y restricciones.
- `V2__seed_currencies.sql`: monedas iniciales.
- `R__dev_seed.sql` (solo `dev`): usuario y cuentas de ejemplo.

## 8. Backend

### 8.1 Seguridad

- Sesión sin estado con **JWT HS256** (`Authorization: Bearer <token>`), vigencia configurable (4 h por defecto). Contraseñas con BCrypt.
- Rutas públicas: `/auth/**`, `/actuator/health` y, en `dev`, Swagger. `/admin/**` requiere rol ADMIN.
- El usuario autenticado se obtiene con el componente `CurrentUser`; ningún servicio lee `SecurityContextHolder` directamente.
- El primer usuario registrado es ADMIN y no se puede crear otro administrador.

### 8.2 Errores

Todas las respuestas de error son `ProblemDetail` con un `code` estable (el frontend lo traduce), `params` opcionales, `errors` (campo → código) para validaciones y `transactionUuid` cuando falla una transacción de un lote. Códigos principales: `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_FUNDS`, `CREDIT_LIMIT_EXCEEDED`, `SENSELESS_TRANSACTION`, `DATE_BEFORE_LAST_TRANSACTION`, `ACCOUNT_DISABLED`, `ACCOUNT_NOT_DELETABLE`, `TRANSACTION_NOT_SUPPORTED`, `INVALID_CRON`.

### 8.3 Listados

`PageParams` (`page`, `size`, `sort`) y `QueryDefinition` definen, por recurso, qué campos se pueden ordenar y filtrar; cualquier otro parámetro se rechaza con `INVALID_QUERY_PARAMETER`. Los filtros se construyen con `Specs` (Specifications de JPA). Tamaño por defecto 20, máximo 100.

### 8.4 Cuentas

- **Actualización parcial:** `PUT /accounts/{id}` solo cambia las propiedades presentes en la petición (un `null` explícito limpia el padre, el ícono o el color); el id nunca cambia. La petición resultante se valida igual que una creación.
- **Jerarquía:** el padre debe aceptar el tipo hijo y no puede ser la propia cuenta ni un descendiente; el subárbol se obtiene con una CTE recursiva.
- **Cambio de tipo:** libre sin sub-cuentas ni transacciones; con ellas solo STORAGE ↔ INVESTMENT y respetando los tipos de sub-cuentas. Una cuenta con crédito debe seguir siendo DEBTOR y un tipo sin saldo exige saldo 0.
- **Edición manual de saldo:** sobrescribe el saldo sin generar transacción e incrementa `version`, de modo que un borrador abierto detecta el cambio.
- **Borrado lógico** (`DELETED`): solo con saldo 0 y sin sub-cuentas vivas.
- **Usables en transacciones:** ACTIVE y distintas de GROUP (`GET /accounts/options`, que incluye `version`, crédito y `lastOperationDate`).
- **En uso** (tarjetas del Inicio): ACTIVE, incluidas en el balance, saldo `> 0` y tipo distinto de SUPPLIER, GROUP y CONSUMER.

### 8.5 Crédito

Al crear o modificar una línea de crédito se calculan la próxima fecha de corte y de pago con su cron (la fecha de hoy cuenta si coincide). Un job diario (`CreditDateJob`, 00:05 `America/Mexico_City`) y una ejecución al arrancar avanzan las fechas que ya pasaron.

### 8.6 Transacciones programadas

- Mismas reglas que una transacción normal: la definición se valida con `TransactionEngine.checkRules` (matriz de cuentas, comisión, cuentas activas), sin tocar saldos.
- Cron de Spring de 6 campos; `GET /schedules/cron/check` devuelve validez y próximas ejecuciones (también lo usa el formulario de crédito).
- La próxima ejecución es siempre una ocurrencia real del cron (con su hora): sin fecha explícita, la primera desde hoy; con fecha, la primera desde ese día; al cambiar el cron se recalcula.
- **Aplicables:** ACTIVE con próxima ejecución hasta el final de mañana.
- Saltar ejecución: `next_execution = cron.next(next_execution)`. Al guardarse en un lote: `last_execution = operation_date` y `next_execution = cron.next(next_execution anterior)`.

### 8.7 Metas

`PUT /goals/{year}` crea o reemplaza la meta del año. `DELETE /goals/{year}` solo procede para el año actual o futuros; la meta de un año que ya terminó se conserva (`GOAL_YEAR_CLOSED`).

## 9. Motor de transacciones

El motor (`transaction/engine`) es **puro**: no depende de Spring ni de la base de datos. `TransactionRules` es la única definición de la matriz de reglas y se expone en `GET /transactions/rules`; el frontend la consume en lugar de duplicarla. Notación: **A** = monto (`> 0`), **F** = comisión (`≥ 0`). Todo el dinero tiene 2 decimales (redondeo *half up*) y los saldos solo suman y restan montos.

### 9.1 Matriz de cuentas por tipo

| Tipo | Origen | Destino | Destino es |
|---|---|---|---|
| INCOME | SUPPLIER | STORAGE | obligatorio |
| EXPENSE | STORAGE, DEBTOR | CONSUMER | obligatorio |
| TRANSFER | STORAGE | STORAGE | obligatorio |
| INVEST | STORAGE, INVESTMENT | INVESTMENT, BUSINESS | obligatorio |
| PROFIT | INVESTMENT, BUSINESS | STORAGE, INVESTMENT | obligatorio |
| DIVIDEND | INVESTMENT, BUSINESS, STORAGE, CREDITOR | los mismos | opcional |
| INTEREST | INVESTMENT, BUSINESS, STORAGE, DEBTOR | — | prohibido |
| BORROW | STORAGE | CREDITOR | obligatorio |
| COLLECTION | CREDITOR | STORAGE | obligatorio |
| DEBT | DEBTOR | STORAGE, CONSUMER | obligatorio |
| PAYMENT | STORAGE | DEBTOR | obligatorio |

Además: origen ≠ destino y ambas cuentas del usuario y ACTIVE.

### 9.2 Comisión

| Caso | Comisión permitida | Debe ser F < A |
|---|---|---|
| INTEREST, BORROW, COLLECTION, DEBT → CONSUMER | No (debe ser 0) | — |
| INCOME, TRANSFER, INVEST, PROFIT, DIVIDEND, DEBT → STORAGE | Sí | Sí |
| EXPENSE, PAYMENT | Sí | No |

### 9.3 Efectos sobre los saldos

*(pendiente)* = el efecto solo ocurre cuando `applied = true`.

| Tipo | Validaciones | Origen | Destino |
|---|---|---|---|
| INCOME | F < A | sin saldo | `+ (A − F)` |
| EXPENSE desde STORAGE | fondos ≥ A + F | `− (A + F)` *(pendiente)* | sin saldo |
| EXPENSE desde DEBTOR | límite de crédito | `+ (A + F)` *(pendiente)* | sin saldo |
| TRANSFER / INVEST / PROFIT | fondos ≥ A; F < A | `− A` (inmediato) | `+ (A − F)` *(pendiente)* |
| DIVIDEND | F < A | sin destino: `+ (A − F)` | con destino: `+ (A − F)` |
| INTEREST (no DEBTOR) | fondos ≥ A | `− A` | — |
| INTEREST (DEBTOR) | límite de crédito | `+ A` | — |
| BORROW | fondos ≥ A | `− A` | `+ A` |
| COLLECTION | A ≤ saldo del CREDITOR | `− A` | `+ A` |
| DEBT → STORAGE | límite de crédito; F < A | `+ A` | `+ (A − F)` |
| DEBT → CONSUMER | límite de crédito | `+ A` | sin saldo |
| PAYMENT | fondos ≥ A + F; A ≤ deuda | `− (A + F)` | `− A` |

- **Límite de crédito:** solo si la DEBTOR tiene línea de crédito: `saldo + aumento ≤ límite`, si no `CREDIT_LIMIT_EXCEEDED`.
- **Sin sentido:** cobrar más de lo prestado o pagar más de lo que se debe da `SENSELESS_TRANSACTION`.
- **Cuenta temporal:** un PROFIT cuyo origen es temporal la deshabilita cuando la transacción se aplica, quede o no saldo. Una transacción posterior del mismo lote que la use falla con `ACCOUNT_DISABLED`.

### 9.4 Pendientes

Cada transacción tiene un único indicador `applied` (por defecto `true`) y su fecha `applied_at` (`= operation_date` si nace aplicada, `NULL` si está pendiente).

| Tipo | Lado pendiente | Lado inmediato |
|---|---|---|
| EXPENSE (desde STORAGE o DEBTOR) | origen | — |
| TRANSFER, INVEST, PROFIT | destino | origen |
| Los demás (incluido PAYMENT) | — (no se permite) | todo |

`applied = false` en otro tipo da `VALIDATION_ERROR` con `PENDING_NOT_ALLOWED`. El lado pendiente guarda `before = after = saldo actual` y no se validan sus fondos o límite hasta aplicarlo.

`PATCH /transactions/{id}/apply` aplica el efecto pendiente (idempotente): bloquea las cuentas, revalida fondos o límite del lado afectado, evalúa la regla de cuenta temporal, registra `applied_at = ahora` y sobrescribe los saldos antes/después de la cuenta afectada. Un tipo sin pendiente da `TRANSACTION_NOT_SUPPORTED`.

### 9.5 Tipo de operación y montos de reportes

| Tipo / variante | `operation_type` |
|---|---|
| INCOME, DIVIDEND | ADDITION |
| EXPENSE (STORAGE o DEBTOR), INTEREST (cualquier origen), DEBT → CONSUMER | SUBTRACTION |
| DEBT → STORAGE, PAYMENT, TRANSFER, INVEST, PROFIT, BORROW, COLLECTION | NEUTER |

El monto que cuenta en reportes se calcula al consultar (no se guarda): ADDITION `A − F` como ingreso; SUBTRACTION `A + F` como gasto; NEUTER solo `F` como gasto (concepto "Comisiones"). Así una compra con tarjeta se reconoce como gasto el día de la compra y el pago de la tarjeta no la cuenta dos veces.

### 9.6 Lote

`POST /transactions/batch` en una sola transacción de base de datos:

1. Validación de estructura (Bean Validation): hasta 500 transacciones, `uuid` único, `amount > 0` con 2 decimales, descripción de 3 a 255 caracteres.
2. Bloqueo pesimista (`PESSIMISTIC_WRITE`) de las cuentas involucradas en orden de id. Cuentas inexistentes, ajenas o eliminadas dan `RESOURCE_NOT_FOUND`; si las `accountVersions` enviadas no coinciden, `CONFLICT`.
3. `operation_date` no puede ser anterior a la última transacción guardada de cada cuenta (`DATE_BEFORE_LAST_TRANSACTION`, con `params.lastOperationDate`).
4. Programadas (`scheduleId`): deben existir, no estar eliminadas, coincidir en tipo y cuentas y no repetirse en el lote.
5. El motor ordena por `operation_date` (desempate por orden de captura) y aplica una por una; la primera falla aborta todo (rollback), con `transactionUuid` y `params.index` de la transacción que falló.
6. Se asigna un `batch_uuid`, se guardan transacciones (con su `operation_type` y saldos antes/después) y saldos, y se avanzan las programadas incluidas.

## 10. Reportes y calendario

Los reportes se calculan en PostgreSQL (`JdbcClient`, `generate_series`, agregaciones por periodo) solo con transacciones aplicadas, agrupadas por `applied_at`, del usuario autenticado y con los montos de la sección 9.5.

| Endpoint | Qué calcula |
|---|---|
| `GET /dashboard/income-statement?dimension=&size=&reference=` | Ingresos, gastos y neto por periodo (YEAR 2–4, MONTH 3–12, WEEK 4–12, DAY 7–15; ventana centrada en la referencia; periodos sin datos en 0; semanas desde el lunes) |
| `GET /dashboard/expenses-by-concept?month=YYYY-MM` | Gastos del mes por concepto: destino CONSUMER (EXPENSE, DEBT → CONSUMER), origen (INTEREST) o "Comisiones" (comisión de las NEUTER) |
| `GET /dashboard/summary` | Árbol de cuentas: total = saldo propio + hijos; se quitan nodos en 0; un nodo con un solo hijo hoja se une como "padre › hijo"; porcentaje respecto al padre. Las DEBTOR no se suman al disponible: se reporta `debt` aparte y `net = assets − debt` |
| `GET /dashboard/progress?years=3` | Metas registradas (las más recientes): neto mensual, acumulado, porcentaje (0–100), esperado a la fecha (`meta × meses transcurridos / 12`) y estado del año y de cada mes (SUCCESS ≥ meta mensual, WARNING ≥ 0, DANGER < 0) |
| `GET /calendar?from=&to=` (máx. 62 días) | Por día: ingresos y gastos aplicados, fechas de corte y pago de cada crédito (fecha guardada más ocurrencias de su cron) con la deuda actual, y ejecuciones futuras de las programadas activas (desde hoy, con tope por serie) |

## 11. Frontend

### 11.1 Organización

- **core:** autenticación (sesión en `localStorage`, *guards*, interceptor que agrega el token y redirige a inicio de sesión ante un 401), interceptor de errores que traduce `ProblemDetail` a mensajes, layout (barra superior, menú lateral ocultable, *breadcrumb*), idioma y tema.
- **shared:** modelos y enums que reflejan el API, *pipes* (dinero, íconos y severidades), componentes (avatar de cuenta, selector de íconos, campo de cron), errores de formulario y la tabla *lazy* sincronizada con la URL (`LazyTable`).
- **features:** una carpeta por área (auth, home, accounts, transactions, schedules, admin), con rutas diferidas.

### 11.2 Convenciones

- Componentes *standalone* con `ChangeDetectionStrategy.OnPush`, *signals* y `rxResource` para cargar datos.
- Todos los componentes de PrimeNG usan su tamaño pequeño (`size="small"` / `pSize="small"`); los colores salen de los tokens del tema (variables `--p-*`) o de utilidades de Tailwind, sin hojas de estilo propias por componente.
- Listados: página, tamaño, orden y filtros viven en los *query params* de la URL, así que recargar o compartir el enlace conserva la vista.
- **Dinero en centavos enteros** (`shared/money`): nunca se calcula con decimales; solo se formatea para mostrar o enviar al API.

### 11.3 Internacionalización y tema

- Español (por defecto) e inglés con `@ngx-translate`; archivos `public/i18n/es.json` y `en.json`, con claves por *feature*. Una prueba verifica que ambos tienen las mismas claves.
- El idioma inicial sale de la preferencia del usuario, luego de `localStorage`, luego del navegador. Al cambiarlo se actualizan también el *locale* de Angular, las traducciones de PrimeNG y el *locale* de `date-fns`.
- Modo claro u oscuro con la preferencia guardada en el navegador. Las gráficas usan una paleta validada para daltonismo, con su versión para modo oscuro.

### 11.4 Editor de lotes

- `TransactionEngine` (TypeScript) replica los efectos del motor del backend en centavos y recibe la matriz de reglas de `GET /transactions/rules`.
- `TransactionDraftStore` guarda el borrador en `localStorage` (`accountant:draft:<userId>`, con versión de esquema y la `version` de cada cuenta) y **recalcula todo desde cero** en cada alta, edición o eliminación: clona las cuentas, ordena por fecha y aplica una por una. Un cambio que hace fallar un lote válido se rechaza.
- Al restaurar, si alguna cuenta cambió de `version` se avisa y se recalcula con los saldos actuales; el lote se envía con esas versiones (`accountVersions`) para detectar cambios concurrentes.
- La vista previa del formulario proyecta el lote con la transacción candidata y muestra los saldos antes/después y el crédito disponible.

## 12. API REST

Todas las rutas son relativas a `/accountant`, en JSON, y requieren `Authorization: Bearer <jwt>` salvo `/auth/**` y `/actuator/health`. Los listados son paginados (`page`, `size`, `sort` y filtros).

```
POST   /auth/sign-in | /auth/sign-up
GET    /me          PATCH /me/language
GET    /currencies/options
GET    /accounts | /accounts/options | /accounts/in-use | /accounts/parent-options | /accounts/{id} | /accounts/{id}/transactions
POST   /accounts      PUT | DELETE /accounts/{id}      PUT | DELETE /accounts/{id}/credit
GET    /transactions | /transactions/{id} | /transactions/rules
POST   /transactions/batch       PATCH /transactions/{id}/apply
GET    /schedules | /schedules/applicable | /schedules/{id} | /schedules/cron/check
POST   /schedules     PUT | DELETE /schedules/{id}     PATCH /schedules/{id}/status | /schedules/{id}/skip
GET    /goals         PUT | DELETE /goals/{year}
GET    /dashboard/income-statement | /dashboard/expenses-by-concept | /dashboard/summary | /dashboard/progress
GET    /calendar?from=&to=
       /admin/users/**   /admin/currencies/**   (solo ADMIN)
GET    /actuator/health
```

Filtros de los listados principales:

| Recurso | Filtros | Orden |
|---|---|---|
| `/accounts` | `name`, `type`, `status`, `parentId`, `includeInBalance`, `isTemporary`, `hasCredit` | `name`, `type`, `balance`, `createdAt` |
| `/transactions` | `type`, `operationType`, `accountId` (origen o destino), `originId`, `destinationId`, `applied`, `dateFrom`/`dateTo` (`operation_date`), `appliedFrom`/`appliedTo` (`applied_at`), `amountMin`, `amountMax`, `description`, `batchUuid` | `operationDate`, `appliedAt`, `amount`, `type`, `createdAt` |
| `/schedules` | `type`, `status`, `accountId`, `nextExecutionFrom`/`nextExecutionTo`, `description` | `nextExecution`, `amount`, `description` |

La documentación interactiva (Swagger UI) está disponible en el perfil `dev`.

## 13. Pruebas y calidad

| Área | Qué se prueba |
|---|---|
| Motor (backend y frontend) | Los mismos casos de [`docs/transaction-cases.json`](transaction-cases.json): cada tipo y variante, validaciones (fondos, límite, sin sentido, comisión), pendientes, cuenta temporal, orden por fecha, redondeo y totales de reportes |
| Reglas | [`docs/transaction-rules.json`](transaction-rules.json) es una copia de `GET /transactions/rules` que usan las pruebas del frontend; una prueba del backend falla si deja de coincidir (se regenera con `./mvnw test -Dtest=TransactionServiceImplTest -Drules.fixture.update=true`) |
| Servicios del backend (Mockito) | Lote (rollback, saldos, programadas, fechas), aplicar pendientes, cuentas (ciclos, cambio de tipo, borrado, actualización parcial), crédito, programadas, metas, reportes (ventanas, árbol, progreso) y expansión de crons del calendario |
| Frontend (Vitest) | Motor TS, borrador (persistencia, restauración, cambio de versión, fechas), dinero, consultas de tabla, i18n (paridad de claves) y autenticación |

Calidad de código: Spotless (palantir-java-format) se ejecuta en `./mvnw verify`; en el frontend, ESLint con `angular-eslint` y Prettier.

## 14. Decisiones de diseño

- **Las transacciones no se editan ni se anulan.** El control está antes de guardar (editor de lotes y resumen); así los saldos guardados en cada transacción siempre son coherentes con la historia.
- **No se reescribe el historial:** una transacción no puede fecharse antes de la última de sus cuentas, de modo que el cálculo siempre parte del saldo actual.
- **Una sola definición de reglas** (`TransactionRules`, expuesta por API) y **un solo conjunto de casos** de prueba para los dos motores.
- **El gasto se reconoce al consumir** (al llegar a una cuenta CONSUMER o por INTEREST); deudas en efectivo y pagos son movimientos internos y solo su comisión cuenta como gasto, para no contar dos veces.
- **Ningún saldo es negativo** (validación del motor y `CHECK` en base de datos) y el dinero nunca usa punto flotante.
- **Concurrencia:** bloqueo pesimista en lote y aplicación, más `version` en cuentas para detectar ediciones mientras un borrador está abierto.
- **Moneda ilustrativa:** no hay conversión; la moneda solo se muestra junto al saldo.
