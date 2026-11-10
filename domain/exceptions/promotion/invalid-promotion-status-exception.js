const { PromotionMessages } = require("../../constants/promotion-messages");

class InvalidPromotionStatusException extends Error {
  constructor(message = PromotionMessages.INVALID_STATUS) {
    super(message);
    this.name = "InvalidPromotionStatusException";
    this.status = 422;
  }
}

module.exports = InvalidPromotionStatusException;

