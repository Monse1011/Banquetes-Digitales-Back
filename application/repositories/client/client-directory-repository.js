/**
 * Contrato del directorio de clientes para el filtro "Cliente" del reporte (contrato 15).
 *
 * @typedef {Object} ClientDirectoryRepository
 * @property {() => Promise<Array<{email: string, name: string}>>} listClientsWithRequests
 *   Clientes con al menos una solicitud (RF-1.2.15.3.12), orden name, email.
 */

module.exports = {};
