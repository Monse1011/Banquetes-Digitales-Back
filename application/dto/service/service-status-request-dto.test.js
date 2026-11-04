const ServiceStatusRequestDto = require("./service-status-request-dto");
const ServiceStatus = require("../../../domain/enums/service/service-status");
const InvalidServiceStatusException = require("../../../domain/exceptions/service/invalid-service-status-exception");
const { ServiceMessages } = require("../../../domain/constants/service-messages");

describe("ServiceStatusRequestDto (Función 2.6)", () => {
  it("accepts ACTIVE and INACTIVE statuses", () => {
    expect(new ServiceStatusRequestDto({ status: "ACTIVE" }).validate()).toEqual({
      status: ServiceStatus.ACTIVE,
    });
    expect(new ServiceStatusRequestDto({ status: "INACTIVE" }).validate()).toEqual({
      status: ServiceStatus.INACTIVE,
    });
  });

  it("accepts Spanish status labels Vigente and No vigente", () => {
    expect(new ServiceStatusRequestDto({ status: "Vigente" }).validate()).toEqual({
      status: ServiceStatus.ACTIVE,
    });
    expect(new ServiceStatusRequestDto({ status: "No vigente" }).validate()).toEqual({
      status: ServiceStatus.INACTIVE,
    });
  });

  it("rejects DELETED status with 422 and specific message (contrato_api endpoint 4)", () => {
    expect(() => new ServiceStatusRequestDto({ status: "DELETED" }).validate()).toThrow(
      InvalidServiceStatusException
    );
    try {
      new ServiceStatusRequestDto({ status: "DELETED" }).validate();
    } catch (error) {
      expect(error.status).toBe(422);
      expect(error.message).toBe(ServiceMessages.DELETED_STATUS_NOT_ALLOWED);
    }
  });

  it("rejects invalid status values with 422", () => {
    const invalidStatuses = ["INVALID", "", null, undefined, 123];

    invalidStatuses.forEach((invalidStatus) => {
      expect(() => new ServiceStatusRequestDto({ status: invalidStatus }).validate()).toThrow(
        InvalidServiceStatusException
      );
    });
  });
});

