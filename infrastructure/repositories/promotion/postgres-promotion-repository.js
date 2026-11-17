// Promociones para el catálogo público (contrato 11). La gestión (contratos 6 a 10) es de
// la Función 2.7 y no vive aquí; expireOutdated() se diseñó para ser invocada también por
// ella (AD-06: una sola implementación, RF-1.2.7.5/7.7).
const MERIDA_TODAY = "(now() AT TIME ZONE 'America/Merida')::date";

class PostgresPromotionRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // UPDATE idempotente: ACTIVE cuya valid_until quedó atrás pasa a INACTIVE. Devuelve el
  // número de filas marcadas (0 en casi todas las llamadas).
  async expireOutdated() {
    const result = await this.pool.query(
      `UPDATE promotions
          SET status = 'INACTIVE'
        WHERE status = 'ACTIVE' AND valid_until < ${MERIDA_TODAY}`
    );

    return result.rowCount;
  }

  // RF-3.4.1.2.2: solo vigentes (ACTIVE y valid_until >= hoy de Mérida), orden name, id.
  async listActiveForPortal() {
    const result = await this.pool.query(
      `SELECT id, name, description, discount_percentage,
              TO_CHAR(valid_until, 'YYYY-MM-DD') AS valid_until
         FROM promotions
        WHERE status = 'ACTIVE' AND valid_until >= ${MERIDA_TODAY}
        ORDER BY name, id`
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description,
      discount_percentage: Number(row.discount_percentage),
      valid_until: row.valid_until,
    }));
  }
}

module.exports = { PostgresPromotionRepository };
