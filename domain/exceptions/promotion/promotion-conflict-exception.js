class PromotionConflictException extends Error {
  constructor(message) {
    super(message);
    this.name = "PromotionConflictException";
    this.status = 409;
  }
}

module.exports = PromotionConflictException;

