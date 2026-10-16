const {
  InMemoryResourceAssignmentRepository,
} = require("./in-memory-resource-assignment-repository");

// Función 3.2 - Asignaciones de recursos (DAD 7.4, assigned_resources). La tabla aún no tiene
// migración: mientras tanto los datos se guardan en un mock en memoria y se pierden al reiniciar
// el servidor. Al crear la tabla solo cambia el contenido de esta clase: las lecturas usarán
// this.pool y las escrituras transaction.connection cuando reciban una transacción.
class PostgresResourceAssignmentRepository {
  constructor(pool) {
    this.pool = pool;
    this.mock = new InMemoryResourceAssignmentRepository();
  }

  async findByRequest(requestId) {
    return this.mock.findByRequest(requestId);
  }

  async findBlocking(resourceIds, period, excludeRequestId) {
    return this.mock.findBlocking(resourceIds, period, excludeRequestId);
  }

  async saveProvisional(assignments, blocking, transaction = null) {
    return this.mock.saveProvisional(assignments, blocking, transaction);
  }

  async confirm(assignments, releasedIds, blocking, transaction = null) {
    return this.mock.confirm(assignments, releasedIds, blocking, transaction);
  }

  async releaseProvisional(requestId, transaction = null) {
    return this.mock.releaseProvisional(requestId, transaction);
  }

  async releaseProvisionalResource(requestId, resourceId, transaction = null) {
    return this.mock.releaseProvisionalResource(requestId, resourceId, transaction);
  }
}

module.exports = { PostgresResourceAssignmentRepository };
