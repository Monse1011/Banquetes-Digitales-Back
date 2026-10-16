function pad(value) {
  return String(value).padStart(2, "0");
}

const COMBINING_MARK_MIN = 0x300;
const COMBINING_MARK_MAX = 0x36f;

// RF-2.3.4.4: NombreCliente sin espacios, acentos ni caracteres especiales.
function sanitizeClientName(clientName) {
  const normalized = clientName.normalize("NFD");
  let withoutAccents = "";

  for (const char of normalized) {
    const code = char.codePointAt(0);

    if (code < COMBINING_MARK_MIN || code > COMBINING_MARK_MAX) {
      withoutAccents += char;
    }
  }

  return withoutAccents.replace(/[^A-Za-z0-9]/g, "");
}

// RF-2.3.4.4: Propuesta_NombreCliente_Fecha_Folio.pdf con Fecha en AAAAMMDD.
function buildProposalFileName(clientName, eventDate, folio) {
  const date = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(
    eventDate.getDate()
  )}`;

  return `Propuesta_${sanitizeClientName(clientName)}_${date}_${folio}.pdf`;
}

module.exports = { buildProposalFileName, sanitizeClientName };
