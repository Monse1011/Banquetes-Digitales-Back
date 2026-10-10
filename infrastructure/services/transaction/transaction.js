// Transacción en curso. connection es la conexión de PostgreSQL (null en memoria). Los
// repositorios que aún guardan en memoria registran con afterRollback cómo deshacer sus cambios,
// porque el ROLLBACK de la base de datos no los alcanza.
class Transaction {
  constructor(connection = null) {
    this.connection = connection;
    this.rollbackActions = [];
  }

  afterRollback(action) {
    this.rollbackActions.push(action);
  }

  // Deshace los cambios en memoria del más reciente al más antiguo.
  undoInMemoryChanges() {
    [...this.rollbackActions].reverse().forEach((action) => action());
  }
}

module.exports = { Transaction };
