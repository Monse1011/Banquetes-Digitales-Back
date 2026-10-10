const { Transaction } = require("./transaction");

class PostgresTransactionManager {
  constructor(pool) {
    this.pool = pool;
  }

  async run(work) {
    const connection = await this.pool.connect();
    const transaction = new Transaction(connection);

    try {
      await connection.query("BEGIN");
      const result = await work(transaction);
      await connection.query("COMMIT");

      return result;
    } catch (error) {
      await connection.query("ROLLBACK");
      transaction.undoInMemoryChanges();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = { PostgresTransactionManager };
