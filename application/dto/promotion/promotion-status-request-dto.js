const { PromotionMessages } = require("../../../domain/constants/promotion-messages");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");
const PromotionConflictException = require("../../../domain/exceptions/promotion/promotion-conflict-exception");
const InvalidPromotionStatusException = require("../../../domain/exceptions/promotion/invalid-promotion-status-exception");

class PromotionStatusRequestDto {
  constructor({ status } = {}) {
    this.status = status;
  }

  validate() {
    if (this.status === PromotionStatus.DELETED || this.status === "Eliminado") {
      throw new InvalidPromotionStatusException(PromotionMessages.DELETED_STATUS_NOT_ALLOWED);
    }

    if (this.status === PromotionStatus.ACTIVE || this.status === "Vigente") {
      throw new PromotionConflictException(PromotionMessages.CANNOT_REACTIVATE);
    }

    if (this.status !== PromotionStatus.INACTIVE && this.status !== "No vigente") {
      throw new InvalidPromotionStatusException(PromotionMessages.INVALID_STATUS);
    }

    return {
      status: PromotionStatus.INACTIVE,
    };
  }
}

module.exports = PromotionStatusRequestDto;

