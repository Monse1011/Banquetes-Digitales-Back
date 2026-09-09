import { Pool } from "pg";
import { ServiceRepository } from "../../application/repositories/service-repository";
import { Service } from "../../domain/entities/service";

interface ServiceRow {
  id_service: number;
  name: string;
  description: string | null;
  status: string;
}

export class PostgresServiceRepository implements ServiceRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<Service[]> {
    const result = await this.pool.query<ServiceRow>(
      `SELECT id_service, name, description, status
       FROM services
       WHERE status = 'activo'
       ORDER BY id_service`,
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  async findByIds(ids: number[]): Promise<Service[]> {
    if (ids.length === 0) return [];

    const result = await this.pool.query<ServiceRow>(
      `SELECT id_service, name, description, status
       FROM services
       WHERE id_service = ANY($1::integer[])`,
      [ids],
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: ServiceRow): Service {
    return new Service(row.id_service, row.name, row.description, row.status);
  }
}
