const {
  InMemoryResourceConfirmationRepository,
} = require("./in-memory-resource-confirmation-repository");

// Función 3.2 - Registro de cada "Finalizar confirmación" y observaciones de la sesión. Las
// tablas aún no tienen migración: mientras tanto los datos se guardan en un mock en memoria y se
// pierden al reiniciar el servidor. Al crear las tablas solo cambia el contenido de esta clase:
// las lecturas usarán this.pool y las escrituras transaction.connection cuando reciban una
// transacción.
class PostgresResourceConfirmationRepository {
  constructor(pool) {
    this.pool = pool;
    this.mock = new InMemoryResourceConfirmationRepository();
  }

  async create(confirmation, transaction = null) {
    return this.mock.create(confirmation, transaction);
  }

  async findLatestByRequest(requestId) {
    return this.mock.findLatestByRequest(requestId);
  }

  async savePendingObservations(requestId, observations, transaction = null) {
    return this.mock.savePendingObservations(requestId, observations, transaction);
  }

  async findPendingObservations(requestId) {
    return this.mock.findPendingObservations(requestId);
  }

  async deletePendingObservations(requestId, transaction = null) {
    return this.mock.deletePendingObservations(requestId, transaction);
  }
}

module.exports = { PostgresResourceConfirmationRepository };
