/**
 * Contratos del contenido público de la Función 4.1 (AD-05: tablas nuevas, sin CRUD admin
 * en este incremento).
 *
 * @typedef {Object} GalleryRepository
 * @property {() => Promise<Array<{id: number, url: string, title: string|null,
 *   alt: string|null}>>} listOrdered por position, id.
 *
 * @typedef {Object} SocialLinkRepository
 * @property {() => Promise<Array<{network: string, url: string}>>} listOrdered por network
 *   (solo redes con enlace registrado, RF-3.4.1.3).
 */

module.exports = {};
