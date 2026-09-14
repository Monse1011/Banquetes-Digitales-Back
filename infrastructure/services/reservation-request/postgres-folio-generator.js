class PostgresFolioGenerator {
  constructor(pool) {
    this.pool = pool;
  }

  async generate() {
    const result = await this.pool.query(
      `INSERT INTO folio_sequence DEFAULT VALUES
       RETURNING folio_count`
    );

    const count = result.rows[0]?.folio_count ?? 1;
    const year = new Date().getFullYear();

    return `BD-${year}-${count.toString().padStart(5, "0")}`;
  }
}

module.exports = PostgresFolioGenerator;
