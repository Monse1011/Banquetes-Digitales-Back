// Incremento 3 (Funciones 4.4 y 4.5): mensajes literales del ERS y del contrato DAD.
const ClientProposalMessages = Object.freeze({
  // RF-3.4.5.1.2: folio con formato inválido o inexistente (400 y 404 comparten mensaje).
  FOLIO_NOT_FOUND:
    "No se encontró ninguna solicitud registrada con el folio ingresado. Verifique e intente nuevamente.",
  // RF-3.4.4.4.7 / contrato accept.
  ACCEPT_TERMS_REQUIRED: "Debe aceptar los términos de la propuesta para continuar.",
  // RF-3.4.4.6.3 / contrato reject.
  REJECT_CONFIRMATION_REQUIRED: "Debe confirmar que no desea continuar con esta propuesta.",
  // RF-3.4.4.5.4 / contrato adjustments.
  OBSERVATIONS_REQUIRED: "Ingrese sus observaciones o los cambios requeridos.",
  OBSERVATIONS_TOO_LONG: "Las observaciones no deben exceder 500 caracteres.",
  // RF-3.4.4.4.2 / 4.4.5.2 / 4.4.6.4: la propuesta ya no admite la acción (409).
  NOT_AVAILABLE_FOR_ACCEPTANCE: "La propuesta ya no se encuentra disponible para su aceptación.",
  NOT_AVAILABLE_FOR_ADJUSTMENTS:
    "La propuesta ya no se encuentra disponible para solicitar ajustes.",
  NOT_AVAILABLE_FOR_REJECTION: "La propuesta ya no se encuentra disponible para su rechazo.",
  // RF-3.4.4.4.3: fallo de la aceptación (409 por disponibilidad o 500 inesperado).
  ACCEPTANCE_FAILED: "No fue posible registrar su aceptación. Intente nuevamente.",
  // Errores comunes del contrato.
  TOO_MANY_REQUESTS: "Demasiadas solicitudes. Intente nuevamente en unos minutos.",
  INTERNAL_ERROR: "Ocurrió un error inesperado. Intente nuevamente.",
});

const OBSERVATIONS_MAX_LENGTH = 500;

module.exports = { ClientProposalMessages, OBSERVATIONS_MAX_LENGTH };
