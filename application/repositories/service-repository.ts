import { Service } from '../../domain/entities/service';

export interface ServiceRepository {
  findAll(): Promise<Service[]>;
  findByIds(ids: number[]): Promise<Service[]>;
}