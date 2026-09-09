import { Client } from "../../domain/entities/client";

export interface ClientRepository {
  findByEmail(email: string): Promise<Client | null>;
  create(client: Client): Promise<Client>;
  update(client: Client): Promise<Client>;
  findById(id: number): Promise<Client | null>;
  findByIds(ids: number[]): Promise<Client[]>;
}
