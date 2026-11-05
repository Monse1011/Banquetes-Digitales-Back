# Pendientes conocidos

Hallazgos detectados al corregir los defectos del incremento 4 que se dejaron fuera a propósito.

## Códigos de estado inconsistentes en la API

El mismo estado se expone con formatos distintos según el endpoint:

- Logística (`GET /api/logistics/requests`, detalle, historial, acuerdos) y calendario
  (`GET /api/*/calendar`) devuelven la etiqueta en español del dominio: `"Confirmado"`,
  `"Finalizado"`.
- Seguimiento del cliente (`GET /api/client/requests/:folio`), consultas del administrador
  (`GET /api/admin/requests`) y la respuesta de `PATCH /api/logistics/requests/:id/ending` devuelven
  el código del contrato (DAD Incremento 3 §3): `"CONFIRMED"`, `"FINALIZED"`.

Unificarlo cambia el contrato de las pantallas que hoy leen la etiqueta. Mientras tanto, el detalle
de logística expone `can_register_finalization` para que el front no compare textos de estado.

## Filtro del historial de logística

`GetAssignedRequestsHistoryUseCase` (`HISTORY_STATUSES`) acepta `"COMPLETED"` y `"CANCELLED"`, que no
existen en el contrato; los códigos reales son `"FINALIZED"` y `"CANCELED"`. Filtrar el historial con
el código del contrato responde 400.

## Migración 002 sin ejecutar

`database/migrations/002-drop-google-calendar-sync.up.sql` elimina `calendar_sync_outbox` y las
columnas `calendar_events.sync_status` / `google_event_id`. El código ya no las usa. Antes de
ejecutarla: respaldar la base y revisar las filas pendientes o con error del outbox. Después de
ejecutarla, quitar esas definiciones de `database/schema.sql` (están marcadas como obsoletas).

## `PostgresAssignedResourceRepository` sin uso y con errores

`infrastructure/repositories/proposal/postgres-assigned-resource-repository.js` no está conectado (la
aplicación usa `ConfirmedResourceAdapter`). Si se reutilizara: su `syncAssignments` ignora la
transacción recibida y hace su propio `COMMIT`, y su `INSERT` omite columnas `NOT NULL`
(`requested_quantity`, `event_start`, `event_end`). Conviene borrarlo o corregirlo.
