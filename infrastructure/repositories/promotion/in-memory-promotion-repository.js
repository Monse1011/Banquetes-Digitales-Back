const { Promotion } = require("../../../domain/entities/promotion/promotion");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");
const { formatMeridaDate } = require("../../../application/services/event-closure/merida-time");

class InMemoryPromotionRepository {
  constructor(promotions = []) {
    this.promotions = promotions.map((promotion) => {
      if (promotion instanceof Promotion) return promotion;
      return new Promotion(
        promotion.id,
        promotion.name,
        promotion.description,
        promotion.discountPercentage ?? promotion.discount_percentage,
        promotion.validUntil ?? promotion.valid_until,
        promotion.status,
        promotion.createdAt ?? promotion.created_at,
        promotion.updatedAt ?? promotion.updated_at
      );
    });
    const currentMaxId = this.promotions.reduce(
      (maxId, promotion) => Math.max(maxId, Number(promotion.id) || 0),
      0
    );
    this.nextId = currentMaxId + 1;
  }

  async expireOutdatedPromotions(currentDate) {
    if (currentDate === undefined || currentDate === null) {
      return this.expireOutdated();
    }

    let expiredCount = 0;
    for (const promotion of this.promotions) {
      if (promotion.status === PromotionStatus.ACTIVE && promotion.validUntil < currentDate) {
        promotion.status = PromotionStatus.INACTIVE;
        expiredCount++;
      }
    }
    return expiredCount;
  }

  // AD-06: misma expiración, evaluando la fecha actual de Mérida (contrato 11).
  async expireOutdated() {
    return this.expireOutdatedPromotions(formatMeridaDate(new Date()));
  }

  // RF-3.4.1.2.2 (contrato 11, Función 4.1): solo ACTIVE y vigentes hoy, orden name, id,
  // sin el campo status. ClientContentController invoca expireOutdated() antes de listar.
  async listActiveForPortal() {
    const today = formatMeridaDate(new Date());

    return this.promotions
      .filter(
        (promotion) => promotion.status === PromotionStatus.ACTIVE && promotion.validUntil >= today
      )
      .sort((promotionA, promotionB) => {
        const nameComparison = (promotionA.name || "").localeCompare(promotionB.name || "");
        if (nameComparison !== 0) return nameComparison;

        return Number(promotionA.id) - Number(promotionB.id);
      })
      .map((promotion) => ({
        id: Number(promotion.id),
        name: promotion.name,
        description: promotion.description,
        discount_percentage: Number(promotion.discountPercentage),
        valid_until: promotion.validUntil,
      }));
  }

  async findAllNotDeleted({ page = 1, per_page: perPage = 10, currentDate } = {}) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }

    const notDeleted = this.promotions.filter(
      (promotion) => promotion.status !== PromotionStatus.DELETED
    );

    const sorted = [...notDeleted].sort((promotionA, promotionB) => {
      const isAActive = promotionA.status === PromotionStatus.ACTIVE;
      const isBActive = promotionB.status === PromotionStatus.ACTIVE;

      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;

      const nameComparison = (promotionA.name || "").localeCompare(promotionB.name || "");
      if (nameComparison !== 0) return nameComparison;

      return Number(promotionA.id) - Number(promotionB.id);
    });

    const startIndex = (page - 1) * perPage;
    const paginated = sorted.slice(startIndex, startIndex + perPage);

    return {
      promotions: paginated.map(
        (promotion) =>
          new Promotion(
            promotion.id,
            promotion.name,
            promotion.description,
            promotion.discountPercentage,
            promotion.validUntil,
            promotion.status,
            promotion.createdAt,
            promotion.updatedAt
          )
      ),
      total_records: notDeleted.length,
    };
  }

  async findAllActive({ page = 1, per_page: perPage = 10, currentDate } = {}) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }

    const activePromotions = this.promotions.filter(
      (promotion) =>
        promotion.status === PromotionStatus.ACTIVE &&
        (!currentDate || promotion.validUntil >= currentDate)
    );

    const sorted = [...activePromotions].sort((promotionA, promotionB) => {
      const nameComparison = (promotionA.name || "").localeCompare(promotionB.name || "");
      if (nameComparison !== 0) return nameComparison;

      return Number(promotionA.id) - Number(promotionB.id);
    });

    const startIndex = (page - 1) * perPage;
    const paginated = sorted.slice(startIndex, startIndex + perPage);

    return {
      promotions: paginated.map(
        (promotion) =>
          new Promotion(
            promotion.id,
            promotion.name,
            promotion.description,
            promotion.discountPercentage,
            promotion.validUntil,
            promotion.status,
            promotion.createdAt,
            promotion.updatedAt
          )
      ),
      total_records: activePromotions.length,
    };
  }

  async findById(id) {
    const found = this.promotions.find((promotion) => Number(promotion.id) === Number(id));
    if (!found) return null;

    return new Promotion(
      found.id,
      found.name,
      found.description,
      found.discountPercentage,
      found.validUntil,
      found.status,
      found.createdAt,
      found.updatedAt
    );
  }

  async checkDuplicateActiveName(name, currentDate) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }
    const targetName = (name || "").trim().toLowerCase();
    return this.promotions.some(
      (promotion) =>
        promotion.status === PromotionStatus.ACTIVE &&
        (!currentDate || promotion.validUntil >= currentDate) &&
        (promotion.name || "").trim().toLowerCase() === targetName
    );
  }

  async checkDuplicateActiveNameExcludeId(name, id, currentDate) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }
    const targetName = (name || "").trim().toLowerCase();
    return this.promotions.some(
      (promotion) =>
        promotion.status === PromotionStatus.ACTIVE &&
        (!currentDate || promotion.validUntil >= currentDate) &&
        Number(promotion.id) !== Number(id) &&
        (promotion.name || "").trim().toLowerCase() === targetName
    );
  }

  async create({
    name,
    description,
    discount_percentage: discountPercentage,
    valid_until: validUntil,
    status = PromotionStatus.ACTIVE,
  }) {
    const id = this.nextId++;
    const createdPromotion = new Promotion(
      id,
      name,
      description,
      discountPercentage,
      validUntil,
      status,
      new Date(),
      new Date()
    );
    this.promotions.push(createdPromotion);

    return new Promotion(
      createdPromotion.id,
      createdPromotion.name,
      createdPromotion.description,
      createdPromotion.discountPercentage,
      createdPromotion.validUntil,
      createdPromotion.status,
      createdPromotion.createdAt,
      createdPromotion.updatedAt
    );
  }

  async update(
    id,
    { name, description, discount_percentage: discountPercentage, valid_until: validUntil }
  ) {
    const index = this.promotions.findIndex((promotion) => Number(promotion.id) === Number(id));
    if (index === -1) return null;

    const current = this.promotions[index];
    current.name = name;
    current.description = description;
    current.discountPercentage = Number(discountPercentage);
    current.validUntil = validUntil;
    current.updatedAt = new Date();

    return new Promotion(
      current.id,
      current.name,
      current.description,
      current.discountPercentage,
      current.validUntil,
      current.status,
      current.createdAt,
      current.updatedAt
    );
  }

  async updateStatus(id, status) {
    const index = this.promotions.findIndex((promotion) => Number(promotion.id) === Number(id));
    if (index === -1) return null;

    const current = this.promotions[index];
    current.status = status;
    current.updatedAt = new Date();

    return new Promotion(
      current.id,
      current.name,
      current.description,
      current.discountPercentage,
      current.validUntil,
      current.status,
      current.createdAt,
      current.updatedAt
    );
  }

  async softDelete(id, currentDate) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }
    return this.updateStatus(id, PromotionStatus.DELETED);
  }
}

module.exports = { InMemoryPromotionRepository };
