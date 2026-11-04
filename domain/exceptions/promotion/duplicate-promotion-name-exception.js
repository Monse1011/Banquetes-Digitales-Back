const { PromotionMessages } = require("../../constants/promotion-messages");

class DuplicatePromotionNameException extends Error {
  constructor(message = PromotionMessages.DUPLICATE_NAME) {
    super(message);
    this.name = "DuplicatePromotionNameException";
    this.status = 409;
  }
}

module.exports = DuplicatePromotionNameException;

