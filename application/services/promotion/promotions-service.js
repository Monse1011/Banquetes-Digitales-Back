const PromotionRequestDto = require("../../dto/promotion/promotion-request-dto");
const PromotionStatusRequestDto = require("../../dto/promotion/promotion-status-request-dto");
const PromotionResponseDto = require("../../dto/promotion/promotion-response-dto");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");
const { PromotionMessages } = require("../../../domain/constants/promotion-messages");
const PromotionNotFoundException = require("../../../domain/exceptions/promotion/promotion-not-found-exception");
const DuplicatePromotionNameException = require("../../../domain/exceptions/promotion/duplicate-promotion-name-exception");
const PromotionConflictException = require("../../../domain/exceptions/promotion/promotion-conflict-exception");
const { formatMeridaDate } = require("../event-closure/merida-time");

class PromotionsService {
  constructor(promotionRepository) {
    this.promotionRepository = promotionRepository;
  }

  getCurrentMeridaDate() {
    return formatMeridaDate(new Date());
  }

  async getPromotionsCatalog({ page = 1, per_page: perPage = 10 } = {}) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const perPageNumber = Math.max(1, Math.min(100, parseInt(perPage, 10) || 10));
    const currentDate = this.getCurrentMeridaDate();

    const { promotions, total_records: totalRecords } =
      await this.promotionRepository.findAllNotDeleted({
        page: pageNumber,
        per_page: perPageNumber,
        currentDate,
      });

    return {
      promotions: PromotionResponseDto.fromEntities(promotions),
      pagination: {
        total_records: totalRecords,
        page: pageNumber,
        per_page: perPageNumber,
      },
    };
  }

  async getClientPromotionsCatalog({ page = 1, per_page: perPage = 10 } = {}) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const perPageNumber = Math.max(1, Math.min(100, parseInt(perPage, 10) || 10));
    const currentDate = this.getCurrentMeridaDate();

    const { promotions, total_records: totalRecords } =
      await this.promotionRepository.findAllActive({
        page: pageNumber,
        per_page: perPageNumber,
        currentDate,
      });

    return {
      promotions: PromotionResponseDto.fromEntitiesForClient(promotions),
      pagination: {
        total_records: totalRecords,
        page: pageNumber,
        per_page: perPageNumber,
      },
    };
  }

  async createPromotion(data) {
    const currentDate = this.getCurrentMeridaDate();
    const dto = new PromotionRequestDto(data);
    const validatedData = dto.validate(currentDate);

    const isDuplicate = await this.promotionRepository.checkDuplicateActiveName(
      validatedData.name,
      currentDate
    );
    if (isDuplicate) {
      throw new DuplicatePromotionNameException(PromotionMessages.DUPLICATE_NAME);
    }

    const createdPromotion = await this.promotionRepository.create({
      name: validatedData.name,
      description: validatedData.description,
      discount_percentage: validatedData.discount_percentage,
      valid_until: validatedData.valid_until,
      status: PromotionStatus.ACTIVE,
    });

    return PromotionResponseDto.fromEntity(createdPromotion);
  }

  async editPromotion(id, data) {
    const currentDate = this.getCurrentMeridaDate();
    await this.promotionRepository.expireOutdatedPromotions(currentDate);

    const existingPromotion = await this.promotionRepository.findById(id);
    if (!existingPromotion || existingPromotion.status === PromotionStatus.DELETED) {
      throw new PromotionNotFoundException(PromotionMessages.NOT_FOUND);
    }

    if (existingPromotion.status === PromotionStatus.INACTIVE) {
      throw new PromotionConflictException(PromotionMessages.CANNOT_EDIT_INACTIVE);
    }

    const dto = new PromotionRequestDto(data);
    const validatedData = dto.validate(currentDate);

    const isDuplicate = await this.promotionRepository.checkDuplicateActiveNameExcludeId(
      validatedData.name,
      Number(id),
      currentDate
    );
    if (isDuplicate) {
      throw new DuplicatePromotionNameException(PromotionMessages.DUPLICATE_NAME);
    }

    const updatedPromotion = await this.promotionRepository.update(Number(id), {
      name: validatedData.name,
      description: validatedData.description,
      discount_percentage: validatedData.discount_percentage,
      valid_until: validatedData.valid_until,
    });

    return PromotionResponseDto.fromEntity(updatedPromotion);
  }

  async deactivatePromotion(id, statusPayload = null) {
    const statusDto = new PromotionStatusRequestDto({ status: statusPayload || PromotionStatus.INACTIVE });
    const { status: targetStatus } = statusDto.validate();

    const currentDate = this.getCurrentMeridaDate();
    await this.promotionRepository.expireOutdatedPromotions(currentDate);

    const existingPromotion = await this.promotionRepository.findById(id);
    if (!existingPromotion || existingPromotion.status === PromotionStatus.DELETED) {
      throw new PromotionNotFoundException(PromotionMessages.NOT_FOUND);
    }

    if (existingPromotion.status === targetStatus) {
      throw new PromotionConflictException(PromotionMessages.STATUS_SAME);
    }

    const updatedPromotion = await this.promotionRepository.updateStatus(
      Number(id),
      PromotionStatus.INACTIVE
    );

    return PromotionResponseDto.fromEntity(updatedPromotion);
  }

  async deletePromotion(id) {
    const currentDate = this.getCurrentMeridaDate();
    await this.promotionRepository.expireOutdatedPromotions(currentDate);

    const existingPromotion = await this.promotionRepository.findById(id);
    if (!existingPromotion || existingPromotion.status === PromotionStatus.DELETED) {
      throw new PromotionNotFoundException(PromotionMessages.NOT_FOUND);
    }

    const deletedPromotion = await this.promotionRepository.softDelete(Number(id), currentDate);
    return PromotionResponseDto.fromEntity(deletedPromotion);
  }
}

module.exports = { PromotionsService };

