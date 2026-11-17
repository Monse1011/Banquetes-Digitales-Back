const { PromotionMessages } = require("../../constants/promotion-messages");

class PromotionNotFoundException extends Error {
  constructor(message = PromotionMessages.NOT_FOUND) {
    super(message);
    this.name = "PromotionNotFoundException";
    this.status = 404;
  }
}

module.exports = PromotionNotFoundException;

