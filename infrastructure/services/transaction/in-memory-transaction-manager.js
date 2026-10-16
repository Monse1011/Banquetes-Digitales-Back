const { Transaction } = require("./transaction");

class InMemoryTransactionManager {
  async run(work) {
    const transaction = new Transaction();

    try {
      return await work(transaction);
    } catch (error) {
      transaction.undoInMemoryChanges();
      throw error;
    }
  }
}

module.exports = { InMemoryTransactionManager };
