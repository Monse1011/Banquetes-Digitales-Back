const UserRole = require("../../../domain/enums/auth/user-role");
const CalendarAccessDeniedException = require("../../../domain/exceptions/calendar/calendar-access-denied-exception");

function isAdmin(actor) {
  return actor?.role === UserRole.ADMIN;
}

function isResponsible(actor, logisticUserId) {
  return (
    actor?.role === UserRole.LOGISTICA && logisticUserId !== null && actor.id === logisticUserId
  );
}

// E.1 / E.2: el Administrador General ve todo; Logística solo lo que tiene a su cargo.
function canViewEvent(actor, logisticUserId) {
  return isAdmin(actor) || isResponsible(actor, logisticUserId);
}

function assertCanViewEvent(actor, logisticUserId) {
  if (!canViewEvent(actor, logisticUserId)) {
    throw new CalendarAccessDeniedException();
  }
}

// C.1: editar corresponde al responsable de logística del evento.
function assertCanEditEvent(actor, logisticUserId) {
  if (!isResponsible(actor, logisticUserId)) {
    throw new CalendarAccessDeniedException();
  }
}

function assertCanListEvents(actor) {
  if (!isAdmin(actor) && actor?.role !== UserRole.LOGISTICA) {
    throw new CalendarAccessDeniedException();
  }
}

module.exports = {
  isAdmin,
  canViewEvent,
  assertCanViewEvent,
  assertCanEditEvent,
  assertCanListEvents,
};
