/**
 * Puerto del generador del documento PDF de la propuesta (RF-2.3.4.4).
 * @typedef {Object} PdfGenerator
 * @property {(proposalData: Object) => Promise<{fileName: string, buffer: Buffer}>}
 *   generate
 * @property {(fileName: string, buffer: Buffer) => Promise<void>} store
 * @property {(fileName: string) => Promise<Buffer>} read
 */

module.exports = {};
