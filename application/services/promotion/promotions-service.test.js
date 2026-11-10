const { PromotionsService } = require("./promotions-service");
const { InMemoryPromotionRepository } = require("../../../infrastructure/repositories/promotion/in-memory-promotion-repository");
const { Promotion } = require("../../../domain/entities/promotion/promotion");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");
const PromotionNotFoundException = require("../../../domain/exceptions/promotion/promotion-not-found-exception");
const DuplicatePromotionNameException = require("../../../domain/exceptions/promotion/duplicate-promotion-name-exception");
const PromotionConflictException = require("../../../domain/exceptions/promotion/promotion-conflict-exception");
const InvalidPromotionStatusException = require("../../../domain/exceptions/promotion/invalid-promotion-status-exception");
const { PromotionMessages } = require("../../../domain/constants/promotion-messages");

describe("PromotionsService (Función 2.7 - Gestión de promociones)", () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = new InMemoryPromotionRepository([
      new Promotion(1, "Descuento de temporada", "Aplica en temporada", 10.0, "2026-12-31", PromotionStatus.ACTIVE),
      new Promotion(2, "Promoción de verano", "Aplica en verano", 5.0, "2026-11-01", PromotionStatus.ACTIVE), // expired relative to 2026-11-04
      new Promotion(3, "Descuento empresarial", "Eventos corporativos", 15.0, "2026-12-31", PromotionStatus.INACTIVE),
      new Promotion(4, "Promoción eliminada", "No debe verse", 20.0, "2026-12-31", PromotionStatus.DELETED),
    ]);
    service = new PromotionsService(repository);
    service.getCurrentMeridaDate = () => "2026-11-04";
  });

  describe("getPromotionsCatalog (RF-1.2.7.2, RF-1.2.7.5)", () => {
    it("expires outdated active promotions and returns active first, then inactive, excluding deleted", async () => {
      const result = await service.getPromotionsCatalog();

      expect(result.pagination.total_records).toBe(3);
      expect(result.promotions).toHaveLength(3);

      // Promotion 1 is active (valid_until 2026-12-31 >= 2026-11-04)
      expect(result.promotions[0].name).toBe("Descuento de temporada");
      expect(result.promotions[0].status).toBe(PromotionStatus.ACTIVE);

      // Promotion 2 was active but expired on 2026-11-01 -> now INACTIVE
      expect(result.promotions[1].name).toBe("Descuento empresarial");
      expect(result.promotions[1].status).toBe(PromotionStatus.INACTIVE);

      expect(result.promotions[2].name).toBe("Promoción de verano");
      expect(result.promotions[2].status).toBe(PromotionStatus.INACTIVE);
    });

    it("returns empty list when no promotions registered (excluding deleted) (RF-1.2.7.2.1)", async () => {
      const emptyRepository = new InMemoryPromotionRepository([
        new Promotion(1, "Eliminada", "Desc", 10, "2026-12-31", PromotionStatus.DELETED),
      ]);
      const emptyService = new PromotionsService(emptyRepository);
      emptyService.getCurrentMeridaDate = () => "2026-11-04";

      const result = await emptyService.getPromotionsCatalog();

      expect(result.promotions).toEqual([]);
      expect(result.pagination.total_records).toBe(0);
    });

    it("applies pagination parameters", async () => {
      const result = await service.getPromotionsCatalog({ page: 1, per_page: 2 });

      expect(result.promotions).toHaveLength(2);
      expect(result.pagination.total_records).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.per_page).toBe(2);
    });
  });

  describe("getClientPromotionsCatalog (RF-1.2.7.5, contrato_api endpoint 11)", () => {
    it("returns only active non-expired promotions without status field", async () => {
      const result = await service.getClientPromotionsCatalog();

      expect(result.promotions).toHaveLength(1);
      expect(result.promotions[0]).toEqual({
        id: 1,
        name: "Descuento de temporada",
        description: "Aplica en temporada",
        discount_percentage: 10.0,
        valid_until: "2026-12-31",
      });
      expect(result.promotions[0].status).toBeUndefined();
    });
  });

  describe("createPromotion (RF-1.2.7.3, RF-1.2.7.3.2, RF-1.2.7.3.4)", () => {
    it("creates a new promotion with status ACTIVE", async () => {
      const created = await service.createPromotion({
        name: "Buen Fin 2026",
        description: "Descuento especial noviembre",
        discount_percentage: 20,
        valid_until: "2026-11-20",
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Buen Fin 2026");
      expect(created.discount_percentage).toBe(20);
      expect(created.status).toBe(PromotionStatus.ACTIVE);

      const catalog = await service.getPromotionsCatalog();
      expect(catalog.pagination.total_records).toBe(4);
    });

    it("rejects duplicate active promotion name case-insensitive and trimmed (RF-1.2.7.3.2)", async () => {
      await expect(
        service.createPromotion({
          name: "  descuento de temporada  ",
          description: "Otra desc",
          discount_percentage: 15,
          valid_until: "2026-12-31",
        })
      ).rejects.toThrow(DuplicatePromotionNameException);

      try {
        await service.createPromotion({
          name: "  descuento de temporada  ",
          description: "Otra desc",
          discount_percentage: 15,
          valid_until: "2026-12-31",
        });
      } catch (error) {
        expect(error.message).toBe(PromotionMessages.DUPLICATE_NAME);
        expect(error.status).toBe(409);
      }
    });

    it("allows creating a promotion with the same name as an expired or inactive promotion", async () => {
      const created = await service.createPromotion({
        name: "Promoción de verano",
        description: "Versión 2027",
        discount_percentage: 8,
        valid_until: "2026-12-31",
      });

      expect(created.name).toBe("Promoción de verano");
      expect(created.status).toBe(PromotionStatus.ACTIVE);
    });
  });

  describe("editPromotion (RF-1.2.7.4, RF-1.2.7.4.1)", () => {
    it("updates an active promotion", async () => {
      const updated = await service.editPromotion(1, {
        name: "Descuento de temporada extendido",
        description: "Nueva descripción",
        discount_percentage: 12.5,
        valid_until: "2027-01-15",
      });

      expect(updated.id).toBe(1);
      expect(updated.name).toBe("Descuento de temporada extendido");
      expect(updated.discount_percentage).toBe(12.5);
      expect(updated.valid_until).toBe("2027-01-15");
    });

    it("rejects editing an inactive promotion with 409 Conflict (RF-1.2.7.4)", async () => {
      await expect(
        service.editPromotion(3, {
          name: "Descuento empresarial modificado",
          description: "Desc",
          discount_percentage: 15,
          valid_until: "2026-12-31",
        })
      ).rejects.toThrow(PromotionConflictException);

      try {
        await service.editPromotion(3, {
          name: "Descuento empresarial modificado",
          description: "Desc",
          discount_percentage: 15,
          valid_until: "2026-12-31",
        });
      } catch (error) {
        expect(error.status).toBe(409);
        expect(error.message).toBe(PromotionMessages.CANNOT_EDIT_INACTIVE);
      }
    });

    it("allows editing without changing the name", async () => {
      const updated = await service.editPromotion(1, {
        name: "Descuento de temporada",
        description: "Solo descripción cambiada",
        discount_percentage: 10,
        valid_until: "2026-12-31",
      });

      expect(updated.name).toBe("Descuento de temporada");
      expect(updated.description).toBe("Solo descripción cambiada");
    });

    it("throws 404 for non-existent or deleted promotion", async () => {
      await expect(
        service.editPromotion(999, {
          name: "Inexistente",
          description: "Desc",
          discount_percentage: 10,
          valid_until: "2026-12-31",
        })
      ).rejects.toThrow(PromotionNotFoundException);

      await expect(
        service.editPromotion(4, {
          name: "Eliminada",
          description: "Desc",
          discount_percentage: 10,
          valid_until: "2026-12-31",
        })
      ).rejects.toThrow(PromotionNotFoundException);
    });
  });

  describe("deactivatePromotion (RF-1.2.7.10, RF-1.2.7.10.2)", () => {
    it("marks active promotion as INACTIVE", async () => {
      const result = await service.deactivatePromotion(1);

      expect(result.id).toBe(1);
      expect(result.status).toBe(PromotionStatus.INACTIVE);

      const stored = await repository.findById(1);
      expect(stored.status).toBe(PromotionStatus.INACTIVE);
    });

    it("rejects deactivating an already inactive promotion with 409 Conflict", async () => {
      await expect(service.deactivatePromotion(3)).rejects.toThrow(PromotionConflictException);
    });

    it("rejects reactivating (status ACTIVE) with 409 Conflict (RF-1.2.7.6)", async () => {
      await expect(service.deactivatePromotion(3, "ACTIVE")).rejects.toThrow(PromotionConflictException);
    });

    it("rejects DELETED status with 422 Unprocessable Entity", async () => {
      await expect(service.deactivatePromotion(1, "DELETED")).rejects.toThrow(
        InvalidPromotionStatusException
      );
    });

    it("throws 404 for non-existent or deleted promotion", async () => {
      await expect(service.deactivatePromotion(999)).rejects.toThrow(PromotionNotFoundException);
      await expect(service.deactivatePromotion(4)).rejects.toThrow(PromotionNotFoundException);
    });
  });

  describe("deletePromotion (RF-1.2.7.2, soft delete)", () => {
    it("soft deletes an active or inactive promotion", async () => {
      const deletedActive = await service.deletePromotion(1);
      expect(deletedActive.id).toBe(1);
      expect(deletedActive.status).toBe(PromotionStatus.DELETED);

      const deletedInactive = await service.deletePromotion(3);
      expect(deletedInactive.id).toBe(3);
      expect(deletedInactive.status).toBe(PromotionStatus.DELETED);

      const catalog = await service.getPromotionsCatalog();
      expect(catalog.pagination.total_records).toBe(1);
    });

    it("throws 404 when deleting an already deleted or non-existent promotion", async () => {
      await expect(service.deletePromotion(4)).rejects.toThrow(PromotionNotFoundException);
      await expect(service.deletePromotion(999)).rejects.toThrow(PromotionNotFoundException);
    });
  });
});

