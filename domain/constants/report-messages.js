// Mensajes de los contratos 13, 14 y 15 (diagrama Función 2.15 y DAD v4.0 §7).
// Viven en domain/ (no en presentation/) porque los consumen el DTO y los use-cases,
// siguiendo la convención de domain/constants/admin-request-messages.js.
const ReportMessages = Object.freeze({
  INVALID_TYPE: "Invalid report type.",
  MISSING_DATE: "Missing required date.",
  MISSING_MONTH: "Missing required month.",
  MISSING_RANGE: "Missing required range.",
  INVALID_RANGE: "El rango seleccionado es inválido.",
  // Formato inválido de fecha/mes/rango o de ids numéricos (DAD: "Campos no validos").
  INVALID_QUERY: "Campos no validos",
  EXPORT_EMPTY: "No hay resultados para exportar.",
});

module.exports = { ReportMessages };
