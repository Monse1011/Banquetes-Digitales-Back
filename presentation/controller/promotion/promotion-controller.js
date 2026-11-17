const { parseId } = require("../../utils/parse-id");

class PromotionController {
  constructor(promotionsService) {
    this.promotionsService = promotionsService;
  }

  // GET /api/admin/promotions (Management Catalog)
  async listAdmin(request, response) {
    const { page, per_page: perPage } = request.query;
    const result = await this.promotionsService.getPromotionsCatalog({
      page,
      per_page: perPage,
    });

    return response.status(200).json({
      data: {
        promotions: result.promotions,
      },
      metadata: {
        pagination: result.pagination,
      },
    });
  }

  // GET /api/client/promotions (Public Catalog)
  async listClient(request, response) {
    const { page, per_page: perPage } = request.query;
    const result = await this.promotionsService.getClientPromotionsCatalog({
      page,
      per_page: perPage,
    });

    return response.status(200).json({
      data: {
        promotions: result.promotions,
      },
      metadata: {
        pagination: result.pagination,
      },
    });
  }

  // POST /api/admin/promotions
  async create(request, response) {
    const payload = request.body?.data || request.body || {};
    const createdPromotion = await this.promotionsService.createPromotion(payload);

    response.setHeader("Location", `/api/admin/promotions/${createdPromotion.id}`);
    return response.status(201).send();
  }

  // PUT /api/admin/promotions/:id and PATCH /api/admin/promotions/:id
  async update(request, response) {
    const promotionId = parseId(request.params.id);
    const payload = request.body?.data || request.body || {};

    if (payload.status !== undefined && payload.name === undefined) {
      await this.promotionsService.deactivatePromotion(promotionId, payload.status);
    } else {
      await this.promotionsService.editPromotion(promotionId, payload);
    }

    return response.status(204).send();
  }

  // PUT /api/admin/promotions/:id/status
  async deactivate(request, response) {
    const promotionId = parseId(request.params.id);
    const payload = request.body?.data || request.body || {};
    await this.promotionsService.deactivatePromotion(promotionId, payload.status);

    return response.status(204).send();
  }

  // DELETE /api/admin/promotions/:id
  async delete(request, response) {
    const promotionId = parseId(request.params.id);
    await this.promotionsService.deletePromotion(promotionId);

    return response.status(204).send();
  }
}

module.exports = { PromotionController };

