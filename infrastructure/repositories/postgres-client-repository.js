const { Client } = require('../../domain/entities/client');

class PostgresClientRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const result = await this.pool.query(
      `SELECT id_client, full_name, email, phone, registration_date
       FROM clients
       WHERE email = $1`,
      [email]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async create(client) {
    const result = await this.pool.query(
      `INSERT INTO clients (full_name, email, phone, registration_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id_client, full_name, email, phone, registration_date`,
      [client.fullName, client.email, client.phone, client.registrationDate]
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error('Client could not be created');
    }

    return this.toEntity(row);
  }

  async update(client) {
    const result = await this.pool.query(
      `UPDATE clients
       SET full_name = $1, email = $2, phone = $3
       WHERE id_client = $4
       RETURNING id_client, full_name, email, phone, registration_date`,
      [client.fullName, client.email, client.phone, client.clientId]
    );

    if (!result.rows[0]) {
      throw new Error('Client not found');
    }

    return this.toEntity(result.rows[0]);
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT id_client, full_name, email, phone, registration_date
       FROM clients
       WHERE id_client = $1`,
      [id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findByIds(ids) {
    if (ids.length === 0) return [];

    const result = await this.pool.query(
      `SELECT id_client, full_name, email, phone, registration_date
       FROM clients
       WHERE id_client = ANY($1::bigint[])`,
      [ids]
    );

    return result.rows.map(row => this.toEntity(row));
  }

  toEntity(row) {
    return new Client(
      Number(row.id_client),
      row.full_name,
      row.email,
      row.phone,
      new Date(row.registration_date)
    );
  }
}

module.exports = { PostgresClientRepository };
