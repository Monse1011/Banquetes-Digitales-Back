const { PostgresTransactionManager } = require("./postgres-transaction-manager");

function buildPool() {
  const connection = {
    queries: [],
    released: false,
    async query(sql) {
      this.queries.push(sql);
      return { rows: [] };
    },
    release() {
      this.released = true;
    },
  };

  return { connection, pool: { connect: async () => connection } };
}

describe("PostgresTransactionManager", () => {
  it("commits when the work finishes and passes it the connection", async () => {
    const { connection, pool } = buildPool();

    const result = await new PostgresTransactionManager(pool).run(async (transaction) => {
      await transaction.connection.query("UPDATE");
      return "done";
    });

    expect(result).toBe("done");
    expect(connection.queries).toEqual(["BEGIN", "UPDATE", "COMMIT"]);
    expect(connection.released).toBe(true);
  });

  it("rolls back the database and the in-memory changes when the work fails", async () => {
    const { connection, pool } = buildPool();
    const undone = [];

    await expect(
      new PostgresTransactionManager(pool).run(async (transaction) => {
        transaction.afterRollback(() => undone.push("first"));
        transaction.afterRollback(() => undone.push("second"));
        throw new Error("Request could not be updated");
      })
    ).rejects.toThrow("Request could not be updated");

    expect(connection.queries).toEqual(["BEGIN", "ROLLBACK"]);
    expect(undone).toEqual(["second", "first"]);
    expect(connection.released).toBe(true);
  });
});
