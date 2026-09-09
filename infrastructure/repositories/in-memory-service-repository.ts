import { Service } from "../../domain/entities/service";
import { ServiceRepository } from "../../application/repositories/service-repository";

export class InMemoryServiceRepository implements ServiceRepository {
  constructor(private readonly services: Service[] = []) {}

  async findAll(): Promise<Service[]> {
    return this.services;
  }

  async findByIds(ids: number[]): Promise<Service[]> {
    return this.services.filter((service) => ids.includes(service.id));
  }
}
