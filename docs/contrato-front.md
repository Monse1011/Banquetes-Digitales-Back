# Cambios de contrato para el front (incremento 4)

Cambios de la API del back por los defectos 1 a 8, agrupados por endpoint. Cada tabla indica el
campo, cómo era antes, cómo es ahora y el error que puede llegar. Los mensajes de error están
copiados tal cual los devuelve el servidor.

> **Rompen clientes actuales** (requieren cambio en el front):
>
> 1. `precio` obligatorio en `POST` y `PATCH /api/admin/resources/human`.
> 2. Acuerdos: omitir una persona en `adjusted_resources` **ya no la libera**; liberar es con
>    `quantity: 0`.
> 3. `PATCH /api/logistics/calendar/:id` rechaza cambios de fecha y hora.
> 4. Se eliminaron `sync_status`, `google_event_id` y `POST /api/logistics/calendar/:id/sync`.
> 5. `PATCH /api/logistics/requests/:id/ending` responde 422 (antes 409) si el estado no es
>    Confirmado.

## Fechas y horas (aplica a todos los endpoints)

Las fechas deben enviarse **con offset o `Z`** (`2030-05-01T18:00:00-06:00`). Sin zona, el servidor
las interpreta con su hora local. Las reglas de horario se evalúan en hora de Mérida.

Regla de "termina al día siguiente" que valida el servidor (el front debe calcularla igual):
`terminaAlDiaSiguiente = horaFin <= horaInicio`. Si se mantiene la casilla, debe estar
deshabilitada cuando `horaFin > horaInicio`.

## Estado del evento: formatos y finalización automática

**Inconsistencia conocida (sin cambios por ahora):** el mismo estado llega con dos formatos.

| Endpoints                                                                                                                                        | Formato             | Ejemplo                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------ |
| Logística (`GET /api/logistics/requests`, `/requests/:id`, historial, `derived-information`) y calendario (`GET /api/logistics\|admin/calendar`) | Etiqueta en español | `"Confirmado"`, `"Finalizado"` |
| Cliente (`GET /api/client/requests/:folio`), administrador (`GET /api/admin/requests`), `PATCH .../ending`                                       | Código del contrato | `"CONFIRMED"`, `"FINALIZED"`   |

No comparen textos de estado para decidir acciones: usen las banderas (`can_register_agreements`,
`can_register_finalization`).

**Finalización automática (nuevo):** un evento Confirmado pasa solo a Finalizado cuando **termina el
día de Mérida de su hora de fin** (si cruza la medianoche, el día de la hora de fin). El cambio se
aplica en cualquier lectura, así que todos los endpoints de arriba pueden mostrar Finalizado sin
que nadie lo haya cerrado. Por eso la línea del tiempo del cliente ya marca Finalizado
(`status: "FINALIZED"` en `GET /api/client/requests/:folio`).

---

## Cliente

### `POST /api/client/request` (crear solicitud)

| Campo             | Antes                                              | Ahora                                                                                   | Error posible (422, `errors.<campo>`)                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_date_time` | Solo rechazaba días anteriores (zona del servidor) | Rechaza también la hora ya pasada de hoy                                                | `La fecha y hora de inicio no pueden ser anteriores al momento actual.`                                                                                                                                                            |
| `event_end_time`  | Solo `fin > inicio`                                | `fin > inicio`; si cae al día siguiente, `horaFin <= horaInicio`; máximo un día después | `La hora de fin debe ser posterior a la hora de inicio.` · `Si el evento termina al día siguiente, la hora de fin debe ser menor o igual a la hora de inicio.` · `El evento no puede terminar más de un día después de su inicio.` |

---

## Administrador: catálogo de recursos

### `POST /api/admin/resources/human` y `PATCH /api/admin/resources/human/:id`

| Campo    | Antes                 | Ahora                                                                                                                                                                                   | Error posible (422, `errors.<campo>`)                                                      |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `precio` | No existía            | **Obligatorio en ambos**, número > 0, máximo 2 decimales, tarifa **por hora**. También al editar personas que ya existían (hoy tienen `precio: null`). No se aceptan cadenas (`"100"`). | `El precio por hora es obligatorio y debe ser un número mayor a 0 con máximo 2 decimales.` |
| `name`   | Aceptaba solo números | Debe tener al menos una letra                                                                                                                                                           | `El nombre completo debe contener al menos una letra.`                                     |

### Lecturas de recursos humanos

| Endpoint                                                                                                      | Antes      | Ahora                                                      |
| ------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `GET /api/admin/resources/human`, `GET /api/admin/resources?type=HUMAN`, `GET /api/admin/resources/human/:id` | Sin precio | Incluyen `precio` (número o `null` en personas anteriores) |
| `GET /api/logistics/resources/human?request_id=`                                                              | Sin precio | Incluye `precio` (comparten el mismo DTO)                  |

### `POST /api/admin/resources/operative-roles` y `PATCH /api/admin/resources/operative-roles/:id`

| Campo  | Antes                 | Ahora                         | Error posible (422, `errors.name`)            |
| ------ | --------------------- | ----------------------------- | --------------------------------------------- |
| `name` | Aceptaba solo números | Debe tener al menos una letra | `El nombre debe contener al menos una letra.` |

---

## Logística: acuerdos y propuesta

### `POST /api/logistics/requests/:id/derived-information` (guardar acuerdos)

| Campo                 | Antes                                                                                                     | Ahora                                                                                                                                                                                                                                                            | Error posible                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adjusted_resources`  | Debían venir **todos** los materiales y recursos logísticos asignados; omitir una **persona** la liberaba | **Solo lo que cambia.** Omitir cualquier recurso (persona, material o logística) lo deja **sin cambios**. **Liberar es explícito con `quantity: 0`** para todos los tipos. Un recurso liberado puede volver a agregarse. Una persona nueva va con `quantity: 1`. | 400 `errors.adjusted_resources`: `El recurso «Camioneta» no está asignado a la solicitud.` · `Mesero Ana: La cantidad ajustada de un recurso humano debe ser 1 o 0 para liberarlo.` |
| (recursos omitidos)   | —                                                                                                         | Se revalidan horario y disponibilidad aunque no se hayan tocado                                                                                                                                                                                                  | 409 `conflicts[].message`: `Camioneta no se modificó, pero su cantidad asignada (1) ya no está disponible para el horario indicado (disponible: 0).`                                |
| `start_datetime`      | Rechazaba días anteriores (en UTC)                                                                        | Exige inicio posterior a "ahora" **solo si cambia** respecto al de la solicitud o los últimos acuerdos (re-guardar el mismo inicio ya pasado funciona)                                                                                                           | 400 `errors.start_datetime`: `La fecha y hora de inicio no pueden ser anteriores al momento actual.`                                                                                |
| `end_datetime`        | Solo `fin > inicio`                                                                                       | Misma regla de día siguiente que al crear                                                                                                                                                                                                                        | 400 `errors.end_datetime`: los tres mensajes de fin de la sección de cliente                                                                                                        |
| `message` (respuesta) | Siempre `Existen campos obligatorios sin completar.`                                                      | Resume los mensajes de los campos con error (`errors` sigue igual)                                                                                                                                                                                               | —                                                                                                                                                                                   |

### `GET /api/logistics/requests/:id/derived-information`

| Campo                         | Antes | Ahora                           |
| ----------------------------- | ----- | ------------------------------- |
| `assigned_resources[].precio` | —     | Nuevo: tarifa por hora o `null` |

### `POST /api/logistics/requests/:id/proposals` (generar propuesta)

| Caso                                | Antes                                        | Ahora                                                                                                      | Error posible                                                                                                                                                                                               |
| ----------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Costo del personal                  | $0 (no tenía precio)                         | `precio × horas del evento`, prorrateado por minutos, con el horario de los acuerdos (cruza la medianoche) | —                                                                                                                                                                                                           |
| Persona asignada con `precio: null` | Se cotizaba en $0 sin avisar                 | Se bloquea                                                                                                 | **422** `{ message, errors.adjusted_resources, resources: [{ resource_id, name }] }`: `No se puede generar la propuesta: Ana López no tiene precio por hora. Asigna un precio por hora antes de continuar.` |
| `client_observations` no texto      | `Existen campos obligatorios sin completar.` | Mensaje específico                                                                                         | 400 `errors.client_observations`: `Las observaciones para el cliente deben ser texto.`                                                                                                                      |

Las propuestas ya generadas no cambian: sus totales están congelados.

---

## Logística: detalle, calendario y cierre

### `GET /api/logistics/requests/:id` (detalle)

| Campo                       | Antes | Ahora                                                                                                                                                                 |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `can_register_finalization` | —     | **Nuevo.** `true` si el evento está Confirmado y hoy (hora de Mérida) está entre el día de inicio y el día de fin. Mostrar "Registrar finalización" con esta bandera. |

### `GET /api/logistics/calendar` y `GET /api/admin/calendar`

| Campo / parámetro      | Antes                                                | Ahora                                                                                               |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `?upcoming=true`       | —                                                    | **Nuevo.** Solo eventos no Finalizados cuya hora de fin aún no pasa. Sin el parámetro, nada cambia. |
| `events[].sync_status` | `"Sincronizado"` / `"Pendiente de sincronización"`   | **Eliminado**                                                                                       |
| `events[].status`      | Finalizado solo si se cerró o se abría el calendario | Puede llegar Finalizado por la finalización automática                                              |

### `POST /api/logistics/requests/:id/calendar` (agendar)

| Campo             | Antes   | Ahora         |
| ----------------- | ------- | ------------- |
| `sync_status`     | Existía | **Eliminado** |
| `google_event_id` | Existía | **Eliminado** |

### `POST /api/logistics/calendar/:id/sync`

**Eliminado** (responde 404). Ya no hay sincronización con Google Calendar ni estado "Pendiente de
sincronizar".

### `PATCH /api/logistics/calendar/:id` (editar evento)

| Campo                            | Antes                                  | Ahora                                 | Error posible (422, `errors.<campo>`)                                                                      |
| -------------------------------- | -------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `start_datetime`, `end_datetime` | Se podían cambiar si no había empezado | **Rechazados** en eventos Confirmados | `No es posible cambiar la fecha ni la hora de un evento confirmado. Solo se puede modificar la ubicación.` |
| `location`                       | Editable                               | Sin cambios: sigue siendo editable    | —                                                                                                          |

### `DELETE /api/logistics/calendar/:id` (cancelar)

Sin cambios de contrato. Un evento cuya hora de fin ya pasó no se puede cancelar, aunque siga
Confirmado hasta el fin del día.

### `PATCH /api/logistics/requests/:id/ending` (registrar finalización)

| Caso                                     | Antes   | Ahora   | Mensaje                                                                            |
| ---------------------------------------- | ------- | ------- | ---------------------------------------------------------------------------------- |
| Estado distinto de Confirmado            | **409** | **422** | `Solo se puede registrar el seguimiento o finalizar eventos en estado Confirmado.` |
| Ya Finalizado (a mano o automáticamente) | **409** | **422** | `El evento ya fue finalizado y no puede modificarse.`                              |
| Fuera del día programado                 | 409     | 409     | `Las horas reales solo pueden registrarse el día programado del evento.`           |

El cierre manual está disponible desde el día de inicio hasta que termina el día de la hora de fin
(un evento que terminó a las 23:00 se puede cerrar a las 23:45; a las 00:01 ya es Finalizado).
