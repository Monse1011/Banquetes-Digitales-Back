// Redes sociales públicas (RF-3.4.1.3): solo redes con enlace registrado (una fila por
// red por la UNIQUE), ordenadas por network.
class PostgresSocialLinkRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listOrdered() {
    const result = await this.pool.query(
      `SELECT network, url
         FROM social_links
        ORDER BY network`
    );

    return result.rows;
  }
}

module.exports = { PostgresSocialLinkRepository };
