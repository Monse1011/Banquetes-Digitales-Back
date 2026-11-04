class Promotion {
  constructor(
    id,
    name,
    description,
    discountPercentage,
    validUntil,
    status,
    createdAt = new Date(),
    updatedAt = new Date()
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.discountPercentage =
      discountPercentage !== null && discountPercentage !== undefined
        ? Number(discountPercentage)
        : null;
    this.validUntil = validUntil;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = { Promotion };

