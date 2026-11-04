const { parseId } = require("../../utils/parse-id");

class ServiceController {
  constructor(serviceRepositoryOrDependencies, servicesService = null) {
    if (serviceRepositoryOrDependencies && serviceRepositoryOrDependencies.servicesService) {
      this.servicesService = serviceRepositoryOrDependencies.servicesService;
      this.serviceRepository = serviceRepositoryOrDependencies.serviceRepository;
    } else {
      this.serviceRepository = serviceRepositoryOrDependencies;
      this.servicesService = servicesService;
    }
  }

  // GET /api/client/services (Client Catalog)
  async list(_request, response) {
    const services = await this.serviceRepository.findAll();

    response.json({
      data: services.map((service) => ({
        id: service.id,
        nombre: service.name,
      })),
    });
  }

  // GET /api/admin/services (Management Catalog)
  async listAdmin(request, response) {
    const { page, per_page: perPage } = request.query;
    const result = await this.servicesService.getServicesCatalog({
      page,
      per_page: perPage,
    });

    return response.status(200).json({
      data: {
        services: result.services,
      },
      metadata: {
        pagination: result.pagination,
      },
    });
  }

  // POST /api/admin/services
  async create(request, response) {
    const payload = request.body?.data || request.body || {};
    const createdService = await this.servicesService.createService(payload);

    response.setHeader("Location", `/api/admin/services/${createdService.id}`);
    return response.status(201).send();
  }

  // PATCH /api/admin/services/:id
  async update(request, response) {
    const serviceId = parseId(request.params.id);
    const payload = request.body?.data || request.body || {};
    await this.servicesService.editService(serviceId, payload);

    return response.status(204).send();
  }

  // PUT /api/admin/services/:id and PUT /api/admin/services/:id/status
  async changeStatus(request, response) {
    const serviceId = parseId(request.params.id);
    const payload = request.body?.data || request.body || {};
    await this.servicesService.changeStatus(serviceId, payload?.status);

    return response.status(204).send();
  }

  // DELETE /api/admin/services/:id
  async delete(request, response) {
    const serviceId = parseId(request.params.id);
    await this.servicesService.deleteService(serviceId);

    return response.status(204).send();
  }
}

module.exports = { ServiceController };
