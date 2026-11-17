const { ServicesService } = require("./services-service");
const { InMemoryServiceRepository } = require("../../../infrastructure/repositories/service/in-memory-service-repository");
const { Service } = require("../../../domain/entities/service/service");
const ServiceStatus = require("../../../domain/enums/service/service-status");
const ServiceNotFoundException = require("../../../domain/exceptions/service/service-not-found-exception");
const DuplicateServiceNameException = require("../../../domain/exceptions/service/duplicate-service-name-exception");
const ServiceConflictException = require("../../../domain/exceptions/service/service-conflict-exception");
const InvalidServiceStatusException = require("../../../domain/exceptions/service/invalid-service-status-exception");
const { ServiceMessages } = require("../../../domain/constants/service-messages");

describe("ServicesService (Función 2.6 - Gestión de servicios)", () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = new InMemoryServiceRepository([
      new Service(1, "Banquetes y bebidas", "Servicio completo", 1500, ServiceStatus.ACTIVE),
      new Service(2, "Música", "Sonido e iluminación", 800, ServiceStatus.ACTIVE),
      new Service(3, "Animación", "Show infantil", 500, ServiceStatus.INACTIVE),
      new Service(4, "Servicio Antiguo", "Ya no disponible", 300, ServiceStatus.DELETED),
    ]);
    service = new ServicesService(repository);
  });

  describe("getServicesCatalog (RF-1.2.6.2, RF-1.2.6.2.1)", () => {
    it("returns active first, then inactive, ordered by name ASC, excluding deleted", async () => {
      const result = await service.getServicesCatalog();

      expect(result.pagination.total_records).toBe(3);
      expect(result.services).toHaveLength(3);

      expect(result.services[0].name).toBe("Banquetes y bebidas");
      expect(result.services[0].status).toBe(ServiceStatus.ACTIVE);

      expect(result.services[1].name).toBe("Música");
      expect(result.services[1].status).toBe(ServiceStatus.ACTIVE);

      expect(result.services[2].name).toBe("Animación");
      expect(result.services[2].status).toBe(ServiceStatus.INACTIVE);
    });

    it("returns empty list when no services registered (excluding deleted) (RF-1.2.6.2.1)", async () => {
      const emptyRepository = new InMemoryServiceRepository([
        new Service(1, "Solo eliminado", "Desc", 100, ServiceStatus.DELETED),
      ]);
      const emptyService = new ServicesService(emptyRepository);

      const result = await emptyService.getServicesCatalog();

      expect(result.services).toEqual([]);
      expect(result.pagination.total_records).toBe(0);
    });

    it("applies pagination parameters", async () => {
      const result = await service.getServicesCatalog({ page: 1, per_page: 2 });

      expect(result.services).toHaveLength(2);
      expect(result.pagination.total_records).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.per_page).toBe(2);
    });
  });

  describe("createService (RF-1.2.6.3, RF-1.2.6.3.2, RF-1.2.6.3.4)", () => {
    it("registers new service with status ACTIVE", async () => {
      const created = await service.createService({
        name: "Fotografía y Video",
        description: "Cobertura completa",
        price: 2500,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Fotografía y Video");
      expect(created.description).toBe("Cobertura completa");
      expect(created.price).toBe(2500);
      expect(created.status).toBe(ServiceStatus.ACTIVE);

      const catalog = await service.getServicesCatalog();
      expect(catalog.pagination.total_records).toBe(4);
    });

    it("rejects duplicate active service name case-insensitive and trimmed (RF-1.2.6.3.2)", async () => {
      await expect(
        service.createService({
          name: "  banquetes y bebidas  ",
          description: "Otra descripción",
          price: 1800,
        })
      ).rejects.toThrow(DuplicateServiceNameException);

      try {
        await service.createService({
          name: "  banquetes y bebidas  ",
          description: "Otra descripción",
          price: 1800,
        });
      } catch (error) {
        expect(error.message).toBe(ServiceMessages.DUPLICATE_NAME);
        expect(error.status).toBe(409);
      }
    });

    it("allows creating a service with the same name as an inactive or deleted service", async () => {
      const createdWithInactiveName = await service.createService({
        name: "Animación",
        description: "Nueva versión activa",
        price: 600,
      });

      expect(createdWithInactiveName.name).toBe("Animación");
      expect(createdWithInactiveName.status).toBe(ServiceStatus.ACTIVE);

      const createdWithDeletedName = await service.createService({
        name: "Servicio Antiguo",
        description: "Recreado",
        price: 350,
      });

      expect(createdWithDeletedName.name).toBe("Servicio Antiguo");
      expect(createdWithDeletedName.status).toBe(ServiceStatus.ACTIVE);
    });
  });

  describe("editService (RF-1.2.6.4, RF-1.2.6.4.1)", () => {
    it("updates name, description and price of an existing service", async () => {
      const updated = await service.editService(1, {
        name: "Banquetes Gourmet",
        description: "Bebidas premium y catering de lujo",
        price: 2200,
      });

      expect(updated.id).toBe(1);
      expect(updated.name).toBe("Banquetes Gourmet");
      expect(updated.description).toBe("Bebidas premium y catering de lujo");
      expect(updated.price).toBe(2200);
    });

    it("allows keeping the same name when modifying the service itself", async () => {
      const updated = await service.editService(1, {
        name: "Banquetes y bebidas",
        description: "Descripción modificada",
        price: 1600,
      });

      expect(updated.name).toBe("Banquetes y bebidas");
      expect(updated.description).toBe("Descripción modificada");
    });

    it("rejects duplicate name matching another active service (RF-1.2.6.3.2)", async () => {
      await expect(
        service.editService(1, {
          name: "  música  ",
          description: "Cambiando a nombre existente",
          price: 900,
        })
      ).rejects.toThrow(DuplicateServiceNameException);
    });

    it("throws 404 when service does not exist or is deleted", async () => {
      await expect(
        service.editService(999, {
          name: "Nuevo nombre",
          description: "Desc",
          price: 500,
        })
      ).rejects.toThrow(ServiceNotFoundException);

      await expect(
        service.editService(4, {
          name: "Servicio eliminado",
          description: "Desc",
          price: 500,
        })
      ).rejects.toThrow(ServiceNotFoundException);
    });
  });

  describe("changeStatus (RF-1.2.6.5, RF-1.2.6.7.1, RF-1.2.6.11)", () => {
    it("marks active service as inactive", async () => {
      const result = await service.changeStatus(1, ServiceStatus.INACTIVE);

      expect(result.id).toBe(1);
      expect(result.status).toBe(ServiceStatus.INACTIVE);

      const stored = await repository.findById(1);
      expect(stored.status).toBe(ServiceStatus.INACTIVE);
    });

    it("rejects setting the same status with 409 Conflict", async () => {
      await expect(service.changeStatus(1, ServiceStatus.ACTIVE)).rejects.toThrow(
        ServiceConflictException
      );
    });

    it("rejects setting DELETED status with 422 Unprocessable Entity", async () => {
      await expect(service.changeStatus(1, ServiceStatus.DELETED)).rejects.toThrow(
        InvalidServiceStatusException
      );
    });

    it("throws 404 for non-existent or deleted service", async () => {
      await expect(service.changeStatus(999, ServiceStatus.INACTIVE)).rejects.toThrow(
        ServiceNotFoundException
      );
      await expect(service.changeStatus(4, ServiceStatus.INACTIVE)).rejects.toThrow(
        ServiceNotFoundException
      );
    });
  });

  describe("reactivateService (RF-1.2.6.11, RF-1.2.6.11.1, RF-1.2.6.11.2)", () => {
    it("reactivates inactive service to ACTIVE", async () => {
      const result = await service.reactivateService(3);

      expect(result.id).toBe(3);
      expect(result.status).toBe(ServiceStatus.ACTIVE);

      const stored = await repository.findById(3);
      expect(stored.status).toBe(ServiceStatus.ACTIVE);
    });

    it("rejects reactivation if another active service has the same name (RF-1.2.6.11.1)", async () => {
      // Create an active service with the same name "Animación"
      await service.createService({
        name: "Animación",
        description: "Servicio nuevo de animación",
        price: 900,
      });

      // Attempt to reactivate service 3 which also has name "Animación"
      await expect(service.reactivateService(3)).rejects.toThrow(DuplicateServiceNameException);

      try {
        await service.reactivateService(3);
      } catch (error) {
        expect(error.message).toBe(ServiceMessages.DUPLICATE_NAME);
        expect(error.status).toBe(409);
      }
    });

    it("throws 409 if service is already ACTIVE", async () => {
      await expect(service.reactivateService(1)).rejects.toThrow(ServiceConflictException);
    });

    it("throws 404 if service is deleted or does not exist", async () => {
      await expect(service.reactivateService(4)).rejects.toThrow(ServiceNotFoundException);
      await expect(service.reactivateService(999)).rejects.toThrow(ServiceNotFoundException);
    });
  });

  describe("deleteService (RF-1.2.6.8, soft delete)", () => {
    it("soft deletes an active or inactive service", async () => {
      const deletedActive = await service.deleteService(1);
      expect(deletedActive.id).toBe(1);
      expect(deletedActive.status).toBe(ServiceStatus.DELETED);

      const deletedInactive = await service.deleteService(3);
      expect(deletedInactive.id).toBe(3);
      expect(deletedInactive.status).toBe(ServiceStatus.DELETED);

      const catalog = await service.getServicesCatalog();
      expect(catalog.pagination.total_records).toBe(1);
      expect(catalog.services[0].id).toBe(2);
    });

    it("throws 404 when deleting an already deleted or non-existent service", async () => {
      await expect(service.deleteService(4)).rejects.toThrow(ServiceNotFoundException);
      await expect(service.deleteService(999)).rejects.toThrow(ServiceNotFoundException);
    });
  });
});

