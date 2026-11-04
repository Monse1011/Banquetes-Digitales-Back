const ServiceRequestDto = require("../../dto/service/service-request-dto");
const ServiceStatusRequestDto = require("../../dto/service/service-status-request-dto");
const ServiceResponseDto = require("../../dto/service/service-response-dto");
const ServiceStatus = require("../../../domain/enums/service/service-status");
const { ServiceMessages } = require("../../../domain/constants/service-messages");
const ServiceNotFoundException = require("../../../domain/exceptions/service/service-not-found-exception");
const DuplicateServiceNameException = require("../../../domain/exceptions/service/duplicate-service-name-exception");
const ServiceConflictException = require("../../../domain/exceptions/service/service-conflict-exception");

class ServicesService {
  constructor(serviceRepository) {
    this.serviceRepository = serviceRepository;
  }

  async getServicesCatalog({ page = 1, per_page: perPage = 10 } = {}) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const perPageNumber = Math.max(1, Math.min(100, parseInt(perPage, 10) || 10));

    const { services, total_records: totalRecords } = await this.serviceRepository.findAllNotDeleted({
      page: pageNumber,
      per_page: perPageNumber,
    });

    return {
      services: ServiceResponseDto.fromEntities(services),
      pagination: {
        total_records: totalRecords,
        page: pageNumber,
        per_page: perPageNumber,
      },
    };
  }

  async createService(data) {
    const dto = new ServiceRequestDto(data);
    const validatedData = dto.validate();

    const isDuplicate = await this.serviceRepository.checkDuplicateActiveName(validatedData.name);
    if (isDuplicate) {
      throw new DuplicateServiceNameException(ServiceMessages.DUPLICATE_NAME);
    }

    const createdService = await this.serviceRepository.create({
      name: validatedData.name,
      description: validatedData.description,
      price: validatedData.price,
      status: ServiceStatus.ACTIVE,
    });

    return ServiceResponseDto.fromEntity(createdService);
  }

  async editService(id, data) {
    const existingService = await this.serviceRepository.findById(id);
    if (!existingService || existingService.status === ServiceStatus.DELETED) {
      throw new ServiceNotFoundException(ServiceMessages.NOT_FOUND);
    }

    const dto = new ServiceRequestDto(data);
    const validatedData = dto.validate();

    const isDuplicate = await this.serviceRepository.checkDuplicateActiveNameExcludeId(
      validatedData.name,
      Number(id)
    );
    if (isDuplicate) {
      throw new DuplicateServiceNameException(ServiceMessages.DUPLICATE_NAME);
    }

    const updatedService = await this.serviceRepository.update(Number(id), {
      name: validatedData.name,
      description: validatedData.description,
      price: validatedData.price,
    });

    return ServiceResponseDto.fromEntity(updatedService);
  }

  async changeStatus(id, newStatus) {
    const statusDto = new ServiceStatusRequestDto({ status: newStatus });
    const { status: targetStatus } = statusDto.validate();

    const existingService = await this.serviceRepository.findById(id);
    if (!existingService || existingService.status === ServiceStatus.DELETED) {
      throw new ServiceNotFoundException(ServiceMessages.NOT_FOUND);
    }

    if (existingService.status === targetStatus) {
      throw new ServiceConflictException(ServiceMessages.STATUS_SAME);
    }

    if (targetStatus === ServiceStatus.ACTIVE) {
      return this.reactivateService(id, existingService);
    }

    const updatedService = await this.serviceRepository.updateStatus(Number(id), ServiceStatus.INACTIVE);
    return ServiceResponseDto.fromEntity(updatedService);
  }

  async reactivateService(id, existingService = null) {
    const serviceToReactivate = existingService ?? (await this.serviceRepository.findById(id));
    if (!serviceToReactivate || serviceToReactivate.status === ServiceStatus.DELETED) {
      throw new ServiceNotFoundException(ServiceMessages.NOT_FOUND);
    }

    if (serviceToReactivate.status === ServiceStatus.ACTIVE) {
      throw new ServiceConflictException(ServiceMessages.STATUS_SAME);
    }

    const isDuplicate = await this.serviceRepository.checkDuplicateActiveName(serviceToReactivate.name);
    if (isDuplicate) {
      throw new DuplicateServiceNameException(ServiceMessages.DUPLICATE_NAME);
    }

    const updatedService = await this.serviceRepository.updateStatus(Number(id), ServiceStatus.ACTIVE);
    return ServiceResponseDto.fromEntity(updatedService);
  }

  async deleteService(id) {
    const existingService = await this.serviceRepository.findById(id);
    if (!existingService || existingService.status === ServiceStatus.DELETED) {
      throw new ServiceNotFoundException(ServiceMessages.NOT_FOUND);
    }

    const deletedService = await this.serviceRepository.softDelete(Number(id));
    return ServiceResponseDto.fromEntity(deletedService);
  }
}

module.exports = { ServicesService };

