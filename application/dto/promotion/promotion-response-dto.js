class PromotionResponseDto {
  static fromEntity(promotion) {
    if (!promotion) return null;

    return {
      id: Number(promotion.id),
      name: promotion.name,
      description: promotion.description,
      discount_percentage:
        promotion.discountPercentage !== null && promotion.discountPercentage !== undefined
          ? Number(promotion.discountPercentage)
          : null,
      valid_until: promotion.validUntil,
      status: promotion.status,
    };
  }

  static fromEntityForClient(promotion) {
    if (!promotion) return null;

    return {
      id: Number(promotion.id),
      name: promotion.name,
      description: promotion.description,
      discount_percentage:
        promotion.discountPercentage !== null && promotion.discountPercentage !== undefined
          ? Number(promotion.discountPercentage)
          : null,
      valid_until: promotion.validUntil,
    };
  }

  static fromEntities(promotions = []) {
    return promotions.map((promotion) => PromotionResponseDto.fromEntity(promotion));
  }

  static fromEntitiesForClient(promotions = []) {
    return promotions.map((promotion) => PromotionResponseDto.fromEntityForClient(promotion));
  }
}

module.exports = PromotionResponseDto;

