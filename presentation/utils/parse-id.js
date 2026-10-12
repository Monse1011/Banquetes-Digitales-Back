const InvalidIdException = require("../../domain/exceptions/common/invalid-id-exception");

// Estándares de Código 2.4: utilidad compartida por los controladores para
// validar los ids numéricos de la URL
function parseId(value, message) {
  const id = Number(typeof value === "string" ? value : NaN);

  if (!Number.isInteger(id) || id < 1) {
    throw new InvalidIdException(message);
  }

  return id;
}

module.exports = { parseId };
