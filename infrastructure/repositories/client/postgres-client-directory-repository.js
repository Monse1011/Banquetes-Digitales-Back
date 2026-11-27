// Contrato 15: clientes con al menos una solicitud (sin importar estado ni periodo),
// ordenados por nombre y luego correo (RF-1.2.15.3.12). La unicidad por correo la garantiza
// el índice único LOWER(email) de clients.
class PostgresClientDirectoryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listClientsWithRequests() {
    const result = await this.pool.query(
      `SELECT c.email, c.full_name AS name
         FROM clients c
        WHERE EXISTS (SELECT 1 FROM reservations_request rr WHERE rr.client_id = c.id)
        ORDER BY c.full_name, c.email`
    );

    return result.rows;
  }
}

module.exports = { PostgresClientDirectoryRepository };
