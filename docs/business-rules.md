# Reglas de negocio — motor de transacciones

Resumen operativo de las secciones 5.2–5.6 de [`PROMPT-accountant-v2.md`](PROMPT-accountant-v2.md), tal como las implementa el motor del backend (`transaction/engine`). El motor del frontend debe comportarse igual; ambos se prueban con [`transaction-cases.json`](transaction-cases.json).

Notación: **A** = monto (`amount` > 0), **F** = comisión o impuesto (`fee` ≥ 0, 0 si se omite). Todo el dinero tiene 2 decimales (redondeo *half up*). **Los saldos solo suman y restan montos**: no hay acumulados auxiliares.

## 1. Matriz de cuentas por tipo

| Tipo | Significado | Origen | Destino | Destino es |
|---|---|---|---|---|
| INCOME | ingreso | SUPPLIER | STORAGE | obligatorio |
| EXPENSE | gasto con dinero propio | STORAGE | CONSUMER | obligatorio |
| TRANSFER | mover entre cuentas propias | STORAGE | STORAGE | obligatorio |
| INVEST | invertir | STORAGE, INVESTMENT | INVESTMENT, BUSINESS | obligatorio |
| PROFIT | retirar los recursos de una inversión | INVESTMENT, BUSINESS | STORAGE, INVESTMENT | obligatorio |
| DIVIDEND | rendimiento de una inversión | INVESTMENT, BUSINESS, STORAGE, CREDITOR | los mismos | opcional |
| INTEREST | interés o cargo en contra | INVESTMENT, BUSINESS, STORAGE, DEBTOR | — | prohibido |
| BORROW | prestar | STORAGE | CREDITOR | obligatorio |
| COLLECTION | cobrar un préstamo | CREDITOR | STORAGE | obligatorio |
| DEBT | endeudarse: efectivo o compra a crédito | DEBTOR | STORAGE, CONSUMER | obligatorio |
| PAYMENT | pagar una deuda | STORAGE | DEBTOR | obligatorio |

Además: origen ≠ destino, ambas cuentas del usuario y **ACTIVE**. Una cuenta GROUP nunca participa. Las compras con tarjeta son **DEBT → CONSUMER**; EXPENSE solo sale de STORAGE.

## 2. Comisión (fee)

| Caso | Fee habilitado | Debe ser F < A | La paga |
|---|---|---|---|
| INTEREST, BORROW, COLLECTION, DEBT → CONSUMER | no (debe ser 0) | — | — |
| INCOME, TRANSFER, INVEST, PROFIT, DEBT → STORAGE, DIVIDEND con destino | sí | **sí** | el destino (recibe A − F) |
| DIVIDEND sin destino | sí | **sí** | el origen (recibe A − F) |
| EXPENSE, PAYMENT | sí | no | el origen (paga A + F) |

## 3. Efectos sobre los saldos

Cada lado cambia **solo cuando está aplicado** (`originApplied` / `destinationApplied`).

| Tipo | Validaciones (al aplicar el lado) | Origen | Destino |
|---|---|---|---|
| INCOME | F < A | sin saldo | `+ (A − F)` |
| EXPENSE | fondos ≥ A + F | `− (A + F)` | sin saldo |
| TRANSFER / INVEST / PROFIT | fondos ≥ A; F < A | `− A` | `+ (A − F)` |
| DIVIDEND | F < A | sin destino: `+ (A − F)` | con destino: `+ (A − F)` (el origen no cambia) |
| INTEREST (no DEBTOR) | fondos ≥ A | `− A` | — |
| INTEREST (DEBTOR) | límite de crédito | `+ A` | — |
| BORROW | fondos ≥ A | `− A` | `+ A` |
| COLLECTION | A ≤ saldo del CREDITOR (si no, `SENSELESS_TRANSACTION`) | `− A` | `+ A` |
| DEBT → STORAGE | límite de crédito; F < A | `+ A` | `+ (A − F)` |
| DEBT → CONSUMER | límite de crédito | `+ A` | sin saldo |
| PAYMENT | fondos ≥ A + F; A ≤ deuda (si no, `SENSELESS_TRANSACTION`) | `− (A + F)` | `− A` |

- **Límite de crédito**: solo si la DEBTOR tiene Credit: `saldo + aumento ≤ límite` (si no, `CREDIT_LIMIT_EXCEEDED`). Sin Credit no hay límite.
- **Cuenta temporal**: un PROFIT cuyo origen es una cuenta temporal la **deshabilita solo si su saldo queda exactamente en 0** y en el momento en que se aplica el origen. Si queda saldo, sigue activa. Una transacción posterior del lote que la use falla con `ACCOUNT_DISABLED`.

## 4. Lados que pueden quedar sin aplicar

| Tipo | Origen | Destino |
|---|---|---|
| EXPENSE | sí | — (CONSUMER) |
| TRANSFER, INVEST, PROFIT | sí | sí |
| DIVIDEND con destino | no | sí |
| INCOME, DIVIDEND sin destino, INTEREST, BORROW, COLLECTION, DEBT, PAYMENT | no | no |

Si se envía `false` en un lado no permitido → `VALIDATION_ERROR` con `PENDING_NOT_ALLOWED` en `originApplied` o `destinationApplied`. Un lado sin aplicar guarda `before = after = saldo actual` y su fecha de aplicación en NULL. **No se validan fondos ni límite de un lado sin aplicar**: se validan cuando se aplica.

## 5. Reportes: tipo de operación, monto reportado y comisiones

Principio: **ingreso cuando el dinero entra a mis cuentas, gasto cuando sale**.

| Tipo / variante | `operationType` | `reportedAmount` |
|---|---|---|
| INCOME, DIVIDEND, DEBT → STORAGE | ADDITION | A |
| EXPENSE, PAYMENT, INTEREST sobre cuenta no DEBTOR | SUBTRACTION | A |
| DEBT → CONSUMER, INTEREST sobre DEBTOR | NEUTER | 0 |
| TRANSFER, INVEST, PROFIT, BORROW, COLLECTION | NEUTER | 0 |

- **Fecha que cuenta**: un ADDITION por `destination_applied_at` (o `origin_applied_at` si no tiene destino); un SUBTRACTION por `origin_applied_at`. Lo no aplicado no cuenta.
- **Comisiones**: toda F > 0 es un **gasto** en el concepto "Comisiones", que solo existe dentro del reporte (no hay cuenta en `accounts`). Cuenta en la fecha de aplicación del lado que la paga (sección 2).
- Ejemplo del ciclo de una tarjeta: compra a crédito 1,000 (NEUTER) → disposición en efectivo 2,000 con comisión 50 (ingreso 2,000, gasto 50) → interés 30 (NEUTER) → pago de 3,030 (gasto 3,030). Neto: −1,080 = compra + comisión + interés.

## 6. Lote (`POST /transactions/batch`)

1. Validación de estructura (Bean Validation): máx. 500 transacciones, `uuid` único, `amount` > 0 con 2 decimales, descripción de 3 a 255 caracteres. `originApplied` / `destinationApplied` son opcionales (default `true`).
2. Bloqueo pesimista de todas las cuentas involucradas, en orden de id. Cuentas inexistentes, de otro usuario o eliminadas → `RESOURCE_NOT_FOUND`. Si el cliente envía `accountVersions` y alguna no coincide → `CONFLICT`.
3. `operationDate` no puede ser anterior a la última transacción **persistida** de cada cuenta involucrada → `DATE_BEFORE_LAST_TRANSACTION` (`params.lastOperationDate`). La misma fecha sí se permite.
4. Programadas (`scheduleId`): deben existir, no estar eliminadas, coincidir en tipo, origen y destino y no repetirse en el lote.
5. El motor ordena por `operationDate` (desempate por orden de captura) y aplica una por una. La primera falla aborta todo (rollback total).
6. Se asigna un `batch_uuid` y se persisten las transacciones (con sus lados aplicados y fechas) y los saldos. Cada programada ejecutada actualiza `last_execution = operation_date` y `next_execution = cron.next(next_execution anterior)`.

## 7. Aplicar lados pendientes (`PATCH /transactions/{id}/apply[?side=ORIGIN|DESTINATION]`)

Sin `side` aplica todos los lados pendientes; con `side`, solo ese. Es idempotente: un lado ya aplicado no cambia. Al aplicar el origen se validan fondos o límite de crédito y se evalúa la regla de cuenta temporal. Cada lado aplicado guarda la fecha del momento (`origin_applied_at` / `destination_applied_at`) y **sobrescribe** sus snapshots con los saldos de ese momento. Pedir el destino de una transacción sin destino → `TRANSACTION_NOT_SUPPORTED`.

## 8. Errores del motor

Todos se devuelven como `ProblemDetail` con `transactionUuid` y `params.index` (posición de la transacción en la petición).

| `code` | Cuándo |
|---|---|
| `INSUFFICIENT_FUNDS` | el origen no alcanza (`params.available`, `params.required`) |
| `CREDIT_LIMIT_EXCEEDED` | la deuda superaría el límite (`params.available`) |
| `SENSELESS_TRANSACTION` | cobrar más de lo prestado o pagar más de lo que se debe |
| `ACCOUNT_DISABLED` | cuenta no ACTIVE (`params.accountId`) |
| `TRANSACTION_NOT_SUPPORTED` | aplicar el destino de una transacción sin destino |
| `VALIDATION_ERROR` | violación de la matriz; `errors` = `{ campo: código }` |

Códigos de campo de `VALIDATION_ERROR`: `SAME_ACCOUNT`, `ORIGIN_NOT_ALLOWED`, `DESTINATION_REQUIRED`, `DESTINATION_NOT_ALLOWED`, `FEE_NOT_ALLOWED`, `FEE_NOT_BELOW_AMOUNT`, `PENDING_NOT_ALLOWED` (`originApplied` / `destinationApplied`), `ACCOUNT_NOT_FOUND` (motor) y, a nivel de lote, `DUPLICATED` (`transactions[i].uuid` / `scheduleId`), `INVALID_SCHEDULE` y `SCHEDULE_MISMATCH`.

## 9. Cuentas relacionadas con el motor

- El **tipo** de una cuenta solo puede cambiar si **no tiene movimientos**.
- No existe un saldo de "gasto por reconocer": la deuda de una DEBTOR es solo su `balance`.
