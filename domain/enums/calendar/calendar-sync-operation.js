// Función 3.3: operación interna que originó una sincronización pendiente. El procesador
// reconcilia siempre contra el estado actual del evento, por lo que es idempotente.
const CalendarSyncOperation = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
});

module.exports = { CalendarSyncOperation };
