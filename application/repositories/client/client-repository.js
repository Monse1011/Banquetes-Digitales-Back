/**
 * @typedef {Object} ClientRepository
 * @property {(email: string) => Promise<Client | null>} findByEmail
 * @property {(client: Client) => Promise<Client>} create
 * @property {(client: Client) => Promise<Client>} update
 * @property {(id: number) => Promise<Client | null>} findById
 * @property {(ids: number[]) => Promise<Client[]>} findByIds
 */

module.exports = {};
