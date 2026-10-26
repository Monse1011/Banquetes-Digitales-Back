// Folio de la solicitud: BD-AAAA-NNNNN (PostgresFolioGenerator). RF-3.4.5.1.1: los
// endpoints públicos validan el formato antes de consultar la solicitud.
const FOLIO_PATTERN = /^BD-\d{4}-\d{5}$/;

function isValidFolio(value) {
  return typeof value === "string" && FOLIO_PATTERN.test(value.trim());
}

function normalizeFolio(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

module.exports = { FOLIO_PATTERN, isValidFolio, normalizeFolio };
