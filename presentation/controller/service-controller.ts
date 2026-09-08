import { Request, Response } from 'express';
import { ServiceRepository } from '../../application/repositories/service-repository';

export class ServiceController {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async list(_request: Request, response: Response): Promise<void> {
    const services = await this.serviceRepository.findAll();

    response.json({
      data: services.map(service => ({
        id: service.id,
        nombre: service.name
      }))
    });
  }
}