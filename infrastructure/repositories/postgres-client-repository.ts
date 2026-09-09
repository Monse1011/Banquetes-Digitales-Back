import { Pool } from "pg";
import { ClientRepository } from "../../application/repositories/client-repository";
import { Client } from "../../domain/entities/client";

interface ClientRow {
  id_client: string;
  full_name: string;
  email: string;
  phone: string;
  registration_date: Date;
}

export class PostgresClientRepository implements ClientRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<Client | null> {
    const result = await this.pool.query<ClientRow>(
      `SELECT id_client, full_name, email, phone, registration_date
       FROM clients
       WHERE email = $1`,
      [email],
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async create(client: Client): Promise<Client> {
    const result = await this.pool.query<ClientRow>(
      `INSERT INTO clients (full_name, email, phone, registration_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id_client, full_name, email, phone, registration_date`,
      [client.fullName, client.email, client.phone, client.registrationDate],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Client could not be created");
    }

    return this.toEntity(row);
  }

  async update(client: Client): Promise<Client> {
    const result = await this.pool.query<ClientRow>(
      `UPDATE clients
       SET full_name = $1, email = $2, phone = $3
       WHERE id_client = $4
       RETURNING id_client, full_name, email, phone, registration_date`,
      [client.fullName, client.email, client.phone, client.clientId],
    );

    if (!result.rows[0]) {
      throw new Error("Client not found");
    }

    return this.toEntity(result.rows[0]);
  }

  async findById(id: number): Promise<Client | null> {
    const result = await this.pool.query<ClientRow>(
      `SELECT id_client, full_name, email, phone, registration_date
       FROM clients
       WHERE id_client = $1`,
      [id],
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findByIds(ids: number[]): Promise<Client[]> {
    if (ids.length === 0) return [];

    const result = await this.pool.query<ClientRow>(
      `SELECT id_client, full_name, email, phone, registration_date
       FROM clients
       WHERE id_client = ANY($1::bigint[])`,
      [ids],
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: ClientRow): Client {
    return new Client(
      Number(row.id_client),
      row.full_name,
      row.email,
      row.phone,
      new Date(row.registration_date),
    );
  }
}
