const UserRole = require("../../../domain/enums/auth/user-role");
const CalendarAccessDeniedException = require("../../../domain/exceptions/calendar/calendar-access-denied-exception");

function isAdmin(actor) {
  return actor?.role === UserRole.ADMIN;
}

function getActorId(actor) {
  return actor?.id ?? actor?.id_user;
}

function isResponsible(actor, logisticUserId) {
  const actorId = getActorId(actor);

  return (
    actor?.role === UserRole.LOGISTICA &&
    logisticUserId !== null &&
    logisticUserId !== undefined &&
    actorId !== null &&
    actorId !== undefined &&
    actorId === logisticUserId
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
  getActorId,
  canViewEvent,
  assertCanViewEvent,
  assertCanEditEvent,
  assertCanListEvents,
};
