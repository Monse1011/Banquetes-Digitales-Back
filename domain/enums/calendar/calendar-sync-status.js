// Función 3.3: estado de sincronización de un evento con Google Calendar. Solo
// «Pendiente de sincronización» lo define el ERS; «Sincronizado» es su complemento.
const CalendarSyncStatus = Object.freeze({
  SYNCED: "Sincronizado",
  PENDING: "Pendiente de sincronización",
});

module.exports = { CalendarSyncStatus };
