# Banquetes-Digitales-Back

## PostgreSQL

La infraestructura incluye `PostgresClientRepository`, `PostgresServiceRepository`
y `PostgresReservationRequestRepository`, compatibles con los puertos de
`application`. La conexión se crea con `createPostgresPool` y acepta
`DATABASE_URL` o las variables `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y
`PGDATABASE`.

El esquema esperado es el definido en `init.sql`. Las operaciones de solicitudes
mantienen `reservations_request` y `request_services` dentro de una transacción.
El arranque actual continúa usando in-memory; para producción se deben construir
los casos de uso con los repositorios PostgreSQL y cerrar el pool durante el
apagado del proceso.