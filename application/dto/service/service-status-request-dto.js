const { ServiceMessages } = require("../../../domain/constants/service-messages");
const ServiceStatus = require("../../../domain/enums/service/service-status");
const InvalidServiceStatusException = require("../../../domain/exceptions/service/invalid-service-status-exception");

class ServiceStatusRequestDto {
  constructor({ status } = {}) {
    this.status = status;
  }

  validate() {
    if (this.status === ServiceStatus.DELETED || this.status === "Eliminado") {
      throw new InvalidServiceStatusException(ServiceMessages.DELETED_STATUS_NOT_ALLOWED);
    }

    if (
      this.status !== ServiceStatus.ACTIVE &&
      this.status !== ServiceStatus.INACTIVE &&
      this.status !== "Vigente" &&
      this.status !== "No vigente"
    ) {
      throw new InvalidServiceStatusException(ServiceMessages.INVALID_STATUS);
    }

    const normalizedStatus =
      this.status === "Vigente" || this.status === ServiceStatus.ACTIVE
        ? ServiceStatus.ACTIVE
        : ServiceStatus.INACTIVE;

    return {
      status: normalizedStatus,
    };
  }
}

module.exports = ServiceStatusRequestDto;

