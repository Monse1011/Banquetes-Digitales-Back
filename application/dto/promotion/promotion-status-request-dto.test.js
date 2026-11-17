const PromotionStatusRequestDto = require("./promotion-status-request-dto");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");
const PromotionConflictException = require("../../../domain/exceptions/promotion/promotion-conflict-exception");
const InvalidPromotionStatusException = require("../../../domain/exceptions/promotion/invalid-promotion-status-exception");
const { PromotionMessages } = require("../../../domain/constants/promotion-messages");

describe("PromotionStatusRequestDto (Función 2.7)", () => {
  it("accepts INACTIVE and No vigente statuses", () => {
    expect(new PromotionStatusRequestDto({ status: "INACTIVE" }).validate()).toEqual({
      status: PromotionStatus.INACTIVE,
    });
    expect(new PromotionStatusRequestDto({ status: "No vigente" }).validate()).toEqual({
      status: PromotionStatus.INACTIVE,
    });
  });

  it("rejects ACTIVE status with 409 Conflict because promotions cannot be reactivated (RF-1.2.7.6, contrato_api endpoint 9)", () => {
    expect(() => new PromotionStatusRequestDto({ status: "ACTIVE" }).validate()).toThrow(
      PromotionConflictException
    );
    try {
      new PromotionStatusRequestDto({ status: "ACTIVE" }).validate();
    } catch (error) {
      expect(error.status).toBe(409);
      expect(error.message).toBe(PromotionMessages.CANNOT_REACTIVATE);
    }
  });

  it("rejects DELETED status with 422 Unprocessable Entity (contrato_api endpoint 9)", () => {
    expect(() => new PromotionStatusRequestDto({ status: "DELETED" }).validate()).toThrow(
      InvalidPromotionStatusException
    );
    try {
      new PromotionStatusRequestDto({ status: "DELETED" }).validate();
    } catch (error) {
      expect(error.status).toBe(422);
      expect(error.message).toBe(PromotionMessages.DELETED_STATUS_NOT_ALLOWED);
    }
  });

  it("rejects invalid status values with 422", () => {
    const invalidStatuses = ["INVALID", "", null, undefined, 123];

    invalidStatuses.forEach((invalidStatus) => {
      expect(() => new PromotionStatusRequestDto({ status: invalidStatus }).validate()).toThrow(
        InvalidPromotionStatusException
      );
    });
  });
});

