# Reglas de negocio — motor de transacciones

Resumen operativo de las secciones 5.2–5.6 de [`PROMPT-accountant-v2.md`](PROMPT-accountant-v2.md), tal como las implementa el motor del backend (`transaction/engine`). El motor del frontend debe comportarse igual; ambos se prueban con [`transaction-cases.json`](transaction-cases.json).

Notación: **A** = monto (`amount` > 0), **F** = comisión (`fee` ≥ 0, 0 si se omite). Todo el dinero tiene 2 decimales (redondeo *half up*).

## 1. Matriz de cuentas por tipo

| Tipo | Origen | Destino | Destino es | Puede quedar pendiente |
|---|---|---|---|---|
| INCOME | SUPPLIER | STORAGE | obligatorio | no |
| EXPENSE | STORAGE, DEBTOR | CONSUMER | obligatorio | **sí** |
| TRANSFER | STORAGE | STORAGE | obligatorio | **sí** |
| INVEST | STORAGE, INVESTMENT | INVESTMENT, BUSINESS | obligatorio | **sí** |
| PROFIT | INVESTMENT, BUSINESS | STORAGE, INVESTMENT | obligatorio | **sí** |
| DIVIDEND | INVESTMENT, BUSINESS, STORAGE, CREDITOR | los mismos | opcional | no |
| INTEREST | INVESTMENT, BUSINESS, STORAGE, DEBTOR | — | prohibido | no |
| BORROW | STORAGE | CREDITOR | obligatorio | no |
| COLLECTION | CREDITOR | STORAGE | obligatorio | no |
| DEBT | DEBTOR | STORAGE, CONSUMER | obligatorio | no |
| PAYMENT | STORAGE | DEBTOR | obligatorio | no |

Además: origen ≠ destino, ambas cuentas del usuario y **ACTIVE**. Una cuenta GROUP nunca participa.

## 2. Comisión (fee)

| Caso | Fee habilitado | Debe ser F < A |
|---|---|---|
| INTEREST, BORROW, COLLECTION, DEBT → CONSUMER | no (debe ser 0) | — |
| INCOME, TRANSFER, INVEST, PROFIT, DIVIDEND, DEBT → STORAGE | sí | **sí** (se descuenta de lo que recibe el destino) |
| EXPENSE, PAYMENT | sí | no (lo paga el origen) |

## 3. Efectos sobre los saldos

| Tipo | Validaciones | Origen | Destino |
|---|---|---|---|
| INCOME | — | sin saldo | `+ (A − F)` |
| EXPENSE desde STORAGE | fondos ≥ A + F (al aplicarse) | `− (A + F)` *pendiente* | sin saldo |
| EXPENSE desde DEBTOR | límite de crédito | `+ (A + F)` *pendiente*; gasto por reconocer `+ (A + F)` | sin saldo |
| TRANSFER / INVEST / PROFIT | fondos ≥ A | `− A` inmediato | `+ (A − F)` *pendiente* |
| DIVIDEND | — | sin destino: `+ (A − F)` | con destino: `+ (A − F)` (el origen no cambia) |
| INTEREST (no DEBTOR) | fondos ≥ A | `− A` | — |
| INTEREST (DEBTOR) | límite de crédito | `+ A`; gasto por reconocer `+ A` | — |
| BORROW | fondos ≥ A | `− A` | `+ A` |
| COLLECTION | A ≤ saldo del CREDITOR (si no, `SENSELESS_TRANSACTION`) | `− A` | `+ A` |
| DEBT → STORAGE | límite de crédito | `+ A`; gasto por reconocer `+ F` | `+ (A − F)` |
| DEBT → CONSUMER | límite de crédito | `+ A`; gasto por reconocer `+ A` | sin efecto |
| PAYMENT | fondos ≥ A + F; A ≤ deuda (si no, `SENSELESS_TRANSACTION`) | `− (A + F)` | `− A`; reconoce `min(A, gasto por reconocer)` |

- **Límite de crédito**: solo si la DEBTOR tiene Credit: `saldo + aumento ≤ límite` (si no, `CREDIT_LIMIT_EXCEEDED`). Sin Credit no hay límite.
- **Pendientes**: en el lado *pendiente* la transacción guarda `before = after = saldo actual`. Un EXPENSE pendiente **no valida fondos al registrarse**; se validan al aplicarlo.
- **Cuenta temporal**: un PROFIT cuyo origen es una cuenta temporal la deshabilita **al registrarse** (aunque el destino quede pendiente y aunque quede saldo). Cualquier transacción posterior del lote que la use falla con `ACCOUNT_DISABLED`.

## 4. Reportes: tipo de operación y monto reportado

| Tipo / variante | `operationType` | `reportedAmount` |
|---|---|---|
| INCOME, DIVIDEND | ADDITION | A − F |
| EXPENSE desde STORAGE | SUBTRACTION | A + F |
| INTEREST sobre cuenta no DEBTOR | SUBTRACTION | A |
| PAYMENT | SUBTRACTION si reconoce algo, si no NEUTER | F + min(A, gasto por reconocer) |
| EXPENSE desde DEBTOR, INTEREST sobre DEBTOR, DEBT | NEUTER | 0 |
| TRANSFER, INVEST, PROFIT, BORROW, COLLECTION | NEUTER | 0 |

El monto reportado de una transacción pendiente ya está calculado, pero los reportes usan `applied_at`: no cuenta hasta aplicarse.

## 5. Lote (`POST /transactions/batch`)

1. Validación de estructura (Bean Validation): máx. 500 transacciones, `uuid` único, `amount` > 0 con 2 decimales, descripción de 3 a 255 caracteres.
2. Bloqueo pesimista de todas las cuentas involucradas, en orden de id. Cuentas inexistentes, de otro usuario o eliminadas → `RESOURCE_NOT_FOUND`. Si el cliente envía `accountVersions` y alguna no coincide → `CONFLICT`.
3. `operationDate` no puede ser anterior a la última transacción **persistida** de cada cuenta involucrada → `DATE_BEFORE_LAST_TRANSACTION` (`params.lastOperationDate`). La misma fecha sí se permite.
4. Programadas (`scheduleId`): deben existir, no estar eliminadas, coincidir en tipo, origen y destino y no repetirse en el lote.
5. El motor ordena por `operationDate` (desempate por orden de captura) y aplica una por una. La primera falla aborta todo (rollback total).
6. Se asigna un `batch_uuid` y se persisten las transacciones y los saldos. Cada programada ejecutada actualiza `last_execution = operation_date` y `next_execution = cron.next(next_execution anterior)`.

## 6. Aplicar pendiente (`PATCH /transactions/{id}/apply`)

Idempotente. Solo EXPENSE (cualquier origen), TRANSFER, INVEST y PROFIT; cualquier otro caso → `TRANSACTION_NOT_SUPPORTED`. Revalida fondos (EXPENSE desde STORAGE) o el límite (EXPENSE desde DEBTOR), registra `applied_at = ahora` y **sobrescribe** los snapshots del lado afectado con los saldos de ese momento.

## 7. Errores del motor

Todos se devuelven como `ProblemDetail` con `transactionUuid` y `params.index` (posición de la transacción en la petición).

| `code` | Cuándo |
|---|---|
| `INSUFFICIENT_FUNDS` | el origen no alcanza (`params.available`, `params.required`) |
| `CREDIT_LIMIT_EXCEEDED` | la deuda superaría el límite (`params.available`) |
| `SENSELESS_TRANSACTION` | cobrar más de lo prestado o pagar más de lo que se debe |
| `ACCOUNT_DISABLED` | cuenta no ACTIVE (`params.accountId`) |
| `TRANSACTION_NOT_SUPPORTED` | aplicar una transacción que no admite pendiente |
| `VALIDATION_ERROR` | violación de la matriz; `errors` = `{ campo: código }` |

Códigos de campo de `VALIDATION_ERROR`: `SAME_ACCOUNT`, `ORIGIN_NOT_ALLOWED`, `DESTINATION_REQUIRED`, `DESTINATION_NOT_ALLOWED`, `FEE_NOT_ALLOWED`, `FEE_NOT_BELOW_AMOUNT`, `PENDING_NOT_ALLOWED`, `ACCOUNT_NOT_FOUND` (motor) y, a nivel de lote, `DUPLICATED` (`transactions[i].uuid` / `scheduleId`), `INVALID_SCHEDULE` y `SCHEDULE_MISMATCH`.
