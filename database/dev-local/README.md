# BD local de desarrollo

`database.sql` + `increment-2` + `increment-3` no reproducen por sí solos el esquema que usan los
repositorios (se escribieron contra `docs/estructura.sql`, que no está versionado). Esta carpeta
aplica las migraciones y cierra los huecos sobre una BD **vacía**:

| Archivo                      | Qué hace                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `05b-pre-status-history.sql` | Agrega `reservations_request.updated_at` y amplía `status` a varchar(30) antes de la 06.                                                                                                                                                                |
| `10-dev-compat.sql`          | Renombra columnas a lo que usa el código (`clients.id`, `services.id`, `client_id`, `event_date`/`event_time`, `proposal_code`…), corrige enums (`ADMIN`/`LOGISTICS`, `HUMAN`/`MATERIAL`/`LOGISTIC`) y crea `calendar_events` / `calendar_sync_outbox`. |
| `20-seed.sql`                | Servicios, roles operativos, recursos de ejemplo y el admin `001` / `Admin123!` (pide cambio de contraseña en el primer acceso).                                                                                                                        |

## Uso (Docker)

```bash
docker run -d --name banquetes-db -e POSTGRES_USER=banquetes -e POSTGRES_PASSWORD=banquetes_dev \
  -e POSTGRES_DB=banquetes_db -e TZ=America/Merida -p 127.0.0.1:5434:5432 postgres:18
bash database/dev-local/rebuild.sh banquetes_db     # BORRA y recrea la BD
```

`.env` correspondiente: `PGHOST=localhost`, `PGPORT=5434`, `PGUSER=banquetes`,
`PGPASSWORD=banquetes_dev`, `PGDATABASE=banquetes_db`.

Pruebas de integración: `SEED=1 bash database/dev-local/rebuild.sh banquetes_test` y luego
`TEST_PGDATABASE=banquetes_test npm run test:run` (con las variables del `.env` exportadas).

## Notas

- El agendado manual (`POST /api/logistics/requests/:id/calendar`) marca la propuesta `ACCEPTED`
  sin `accepted_at`/`accepted_pdf_path`; `10-dev-compat.sql` relaja esas dos restricciones.
- `05b` y `10` solo existen porque falta el esquema base versionado; cuando `docs/estructura.sql`
  se suba al repo, esta carpeta se reduce a los datos semilla.
