import { Service } from '../../domain/entities/service';

export interface ServiceRepository {
  findByIds(ids: number[]): Promise<Service[]>;
}