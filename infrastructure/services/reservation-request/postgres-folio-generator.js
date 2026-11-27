class PostgresFolioGenerator {
  constructor(pool) {
    this.pool = pool;
  }
  async generate() {
    const result = await this.pool.query(
      `INSERT INTO document_counters (kind, year, last_number)
       VALUES ('REQUEST_FOLIO', EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Merida')::int, 1)
       ON CONFLICT (kind, year) DO UPDATE
       SET last_number = document_counters.last_number + 1
       RETURNING year, last_number`
    );
    const { year, last_number: count } = result.rows[0];
    return `BD-${year}-${String(count).padStart(5, "0")}`;
  }
}
module.exports = PostgresFolioGenerator;
