# Reglas de negocio — motor de transacciones

Resumen operativo de las secciones 5.2–5.6 de [`PROMPT-accountant-v2.md`](PROMPT-accountant-v2.md), tal como las implementa el motor del backend (`transaction/engine`). El motor del frontend debe comportarse igual; ambos se prueban con [`transaction-cases.json`](transaction-cases.json).

Notación: **A** = monto (`amount` > 0), **F** = comisión o impuesto (`fee` ≥ 0, 0 si se omite). Todo el dinero tiene 2 decimales (redondeo *half up*). **Los saldos solo suman y restan montos**: no hay acumulados auxiliares.

## 1. Matriz de cuentas por tipo

| Tipo | Significado | Origen | Destino | Destino es |
|---|---|---|---|---|
| INCOME | ingreso | SUPPLIER | STORAGE | obligatorio |
| EXPENSE | gasto (con dinero propio o con tarjeta) | STORAGE, DEBTOR | CONSUMER | obligatorio |
| TRANSFER | mover entre cuentas propias | STORAGE | STORAGE | obligatorio |
| INVEST | invertir | STORAGE, INVESTMENT | INVESTMENT, BUSINESS | obligatorio |
| PROFIT | retirar los recursos de una inversión | INVESTMENT, BUSINESS | STORAGE, INVESTMENT | obligatorio |
| DIVIDEND | rendimiento de una inversión | INVESTMENT, BUSINESS, STORAGE, CREDITOR | los mismos | opcional |
| INTEREST | interés o cargo en contra | INVESTMENT, BUSINESS, STORAGE, DEBTOR | — | prohibido |
| BORROW | prestar | STORAGE | CREDITOR | obligatorio |
| COLLECTION | cobrar un préstamo | CREDITOR | STORAGE | obligatorio |
| DEBT | endeudarse: efectivo o compra a crédito | DEBTOR | STORAGE, CONSUMER | obligatorio |
| PAYMENT | pagar una deuda | STORAGE | DEBTOR | obligatorio |

Además: origen ≠ destino, ambas cuentas del usuario y **ACTIVE**. Una cuenta GROUP nunca participa. Una compra con tarjeta puede registrarse como **EXPENSE Visa → Comida** o como **DEBT Visa → Comida**; ambas son equivalentes para reportes.

## 2. Comisión (fee)

| Caso | Fee habilitado | Debe ser F < A | Efecto |
|---|---|---|---|
| INTEREST, BORROW, COLLECTION, DEBT → CONSUMER | no (debe ser 0) | — | — |
| INCOME, TRANSFER, INVEST, PROFIT, DEBT → STORAGE, DIVIDEND | sí | **sí** | quien recibe obtiene A − F |
| EXPENSE, PAYMENT | sí | no | el origen paga (o debe) A + F |

## 3. Efectos sobre los saldos

| Tipo | Validaciones | Origen | Destino |
|---|---|---|---|
| INCOME | F < A | sin saldo | `+ (A − F)` |
| EXPENSE desde STORAGE | fondos ≥ A + F | `− (A + F)` *(pendiente)* | sin saldo |
| EXPENSE desde DEBTOR | límite de crédito | `+ (A + F)` *(pendiente)* | sin saldo |
| TRANSFER / INVEST / PROFIT | fondos ≥ A; F < A | `− A` (siempre inmediato) | `+ (A − F)` *(pendiente)* |
| DIVIDEND | F < A | sin destino: `+ (A − F)` | con destino: `+ (A − F)` (el origen no cambia) |
| INTEREST (no DEBTOR) | fondos ≥ A | `− A` | — |
| INTEREST (DEBTOR) | límite de crédito | `+ A` | — |
| BORROW | fondos ≥ A | `− A` | `+ A` |
| COLLECTION | A ≤ saldo del CREDITOR (si no, `SENSELESS_TRANSACTION`) | `− A` | `+ A` |
| DEBT → STORAGE | límite de crédito; F < A | `+ A` | `+ (A − F)` |
| DEBT → CONSUMER | límite de crédito | `+ A` | sin saldo |
| PAYMENT | fondos ≥ A + F; A ≤ deuda (si no, `SENSELESS_TRANSACTION`) | `− (A + F)` | `− A` |

*(pendiente)* = ese efecto solo ocurre cuando `applied = true`.

- **Límite de crédito**: solo si la DEBTOR tiene Credit: `saldo + aumento ≤ límite` (si no, `CREDIT_LIMIT_EXCEEDED`). Sin Credit no hay límite.
- **Cuenta temporal**: un PROFIT cuyo origen es una cuenta temporal la **deshabilita al aplicarse la transacción**, quede o no saldo remanente. Mientras el PROFIT esté pendiente la cuenta sigue activa. Una transacción posterior del lote que la use falla con `ACCOUNT_DISABLED`.

## 4. Transacciones pendientes

Cada transacción tiene un solo indicador `applied` (default `true`) y su fecha `applied_at` (= `operation_date` si nace aplicada; NULL si está pendiente).

| Tipo | Lado pendiente | Lado inmediato |
|---|---|---|
| EXPENSE (desde STORAGE o DEBTOR) | origen | — |
| TRANSFER, INVEST, PROFIT | destino | origen (se descuenta al registrar) |
| Los demás (incluido PAYMENT) | — (`applied = false` no permitido) | todo |

Si se envía `applied = false` en un tipo no permitido → `VALIDATION_ERROR` con `PENDING_NOT_ALLOWED` en `applied`. El lado pendiente guarda `before = after = saldo actual`. **No se validan fondos ni límite del lado pendiente**: se validan cuando se aplica.

## 5. Reportes: tipo de operación y monto que cuenta

Principio: **el gasto se reconoce al llegar a una cuenta CONSUMER (o por INTEREST)**; deudas en efectivo y pagos son movimientos internos.

| Tipo / variante | `operationType` |
|---|---|
| INCOME, DIVIDEND | ADDITION |
| EXPENSE (desde STORAGE o DEBTOR), INTEREST (cualquier origen), DEBT → CONSUMER | SUBTRACTION |
| DEBT → STORAGE, PAYMENT, TRANSFER, INVEST, PROFIT, BORROW, COLLECTION | NEUTER |

Monto que cuenta (se calcula en la consulta, **no se persiste**):

- ADDITION → ingreso `A − F`.
- SUBTRACTION → gasto `A + F`.
- NEUTER → solo `F` como gasto, en el concepto "Comisiones" (existe solo en el reporte, no en `accounts`).

Todos los reportes usan `applied_at`: lo pendiente no cuenta hasta aplicarse.

| Escenario | Transacciones | Ingreso | Gasto | Neto |
|---|---|---|---|---|
| Préstamo en efectivo usado y pagado | DEBT → STORAGE 10,000 → EXPENSE 10,000 → PAYMENT 10,000 | 0 | 10,000 | −10,000 |
| Préstamo en efectivo devuelto sin usar | DEBT → STORAGE 10,000 → PAYMENT 10,000 | 0 | 0 | 0 |
| Compra con TDC y pago | EXPENSE desde DEBTOR 10,000 → PAYMENT 10,000 | 0 | 10,000 | −10,000 |
| Compra a crédito y pago | DEBT → CONSUMER 10,000 → PAYMENT 10,000 | 0 | 10,000 | −10,000 |
| Interés de la TDC y pago | INTEREST sobre DEBTOR 500 → PAYMENT 500 | 0 | 500 | −500 |
| Pago con comisión | PAYMENT 10,000 con fee 50 | 0 | 50 | −50 |

## 6. Lote (`POST /transactions/batch`)

1. Validación de estructura (Bean Validation): máx. 500 transacciones, `uuid` único, `amount` > 0 con 2 decimales, descripción de 3 a 255 caracteres. `applied` es opcional (default `true`).
2. Bloqueo pesimista de todas las cuentas involucradas, en orden de id. Cuentas inexistentes, de otro usuario o eliminadas → `RESOURCE_NOT_FOUND`. Si el cliente envía `accountVersions` y alguna no coincide → `CONFLICT`.
3. `operationDate` no puede ser anterior a la última transacción **persistida** de cada cuenta involucrada → `DATE_BEFORE_LAST_TRANSACTION` (`params.lastOperationDate`). La misma fecha sí se permite.
4. Programadas (`scheduleId`): deben existir, no estar eliminadas, coincidir en tipo, origen y destino y no repetirse en el lote.
5. El motor ordena por `operationDate` (desempate por orden de captura) y aplica una por una. La primera falla aborta todo (rollback total).
6. Se asigna un `batch_uuid` y se persisten las transacciones y los saldos. Cada programada ejecutada actualiza `last_execution = operation_date` y `next_execution = cron.next(next_execution anterior)`.

## 7. Aplicar una transacción pendiente (`PATCH /transactions/{id}/apply`)

Aplica el efecto pendiente (sección 4) y es idempotente: si ya está aplicada no cambia nada. Al aplicar se validan fondos o límite de crédito del lado afectado (EXPENSE: el origen) y se evalúa la regla de cuenta temporal (PROFIT). Se registra `applied_at = now` y se **sobrescriben** los snapshots de la cuenta afectada con los saldos de ese momento. Aplicar un tipo sin efecto pendiente → `TRANSACTION_NOT_SUPPORTED`.

## 8. Errores del motor

Todos se devuelven como `ProblemDetail` con `transactionUuid` y `params.index` (posición de la transacción en la petición).

| `code` | Cuándo |
|---|---|
| `INSUFFICIENT_FUNDS` | el origen no alcanza (`params.available`, `params.required`) |
| `CREDIT_LIMIT_EXCEEDED` | la deuda superaría el límite (`params.available`) |
| `SENSELESS_TRANSACTION` | cobrar más de lo prestado o pagar más de lo que se debe |
| `ACCOUNT_DISABLED` | cuenta no ACTIVE (`params.accountId`) |
| `TRANSACTION_NOT_SUPPORTED` | aplicar una transacción cuyo tipo no admite pendiente |
| `VALIDATION_ERROR` | violación de la matriz; `errors` = `{ campo: código }` |

Códigos de campo de `VALIDATION_ERROR`: `SAME_ACCOUNT`, `ORIGIN_NOT_ALLOWED`, `DESTINATION_REQUIRED`, `DESTINATION_NOT_ALLOWED`, `FEE_NOT_ALLOWED`, `FEE_NOT_BELOW_AMOUNT`, `PENDING_NOT_ALLOWED` (`applied`), `ACCOUNT_NOT_FOUND` (motor) y, a nivel de lote, `DUPLICATED` (`transactions[i].uuid` / `scheduleId`), `INVALID_SCHEDULE` y `SCHEDULE_MISMATCH`.

## 9. Cuentas relacionadas con el motor

- Si la cuenta tiene sub-cuentas o transacciones, su **tipo** solo puede cambiar entre STORAGE e INVESTMENT (y el nuevo tipo debe aceptar las sub-cuentas existentes). Sin sub-cuentas ni transacciones, cualquier cambio es válido.
- Una cuenta con línea de crédito debe seguir siendo DEBTOR; cambiar a un tipo sin saldo exige saldo 0.
- No existe un saldo de "gasto por reconocer": la deuda de una DEBTOR es solo su `balance`.
