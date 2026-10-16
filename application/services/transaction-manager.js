/**
 * Ejecuta work en una sola transacción: si termina, se confirman todos sus cambios; si lanza un
 * error, se deshacen y el error se vuelve a lanzar. Los repositorios reciben la transacción como
 * último parámetro de sus escrituras.
 *
 * @typedef {Object} TransactionManager
 * @property {<T>(work: (transaction: Transaction) => Promise<T>) => Promise<T>} run
 */

module.exports = {};
