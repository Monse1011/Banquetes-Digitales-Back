const BLOCKING_EXTENSION_MS = 3 * 60 * 60 * 1000;

// RF-2.3.2.13: el periodo de bloqueo de un recurso es la duración del evento
// más 3 horas posteriores a su finalización.
function blockingEnd(endDateTime) {
  return new Date(endDateTime.getTime() + BLOCKING_EXTENSION_MS);
}

// RF-2.3.2.12: hay conflicto cuando los periodos de bloqueo se traslapan.
// Un evento que inicia exactamente 3 horas después del fin de otro no conflictúa.
function blockingWindowsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < blockingEnd(rightEnd) && rightStart < blockingEnd(leftEnd);
}

// Traslape simple de horarios (agenda del responsable, RF-1.2.4.4).
function windowsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

module.exports = {
  BLOCKING_EXTENSION_MS,
  blockingEnd,
  blockingWindowsOverlap,
  windowsOverlap,
};
