class ServiceController {
  constructor(serviceRepository) {
    this.serviceRepository = serviceRepository;
  }

  async list(_request, response) {
    const services = await this.serviceRepository.findAll();

    response.json({
      data: services.map(service => ({
        id: service.id,
        nombre: service.name
      }))
    });
  }
}

module.exports = { ServiceController };
