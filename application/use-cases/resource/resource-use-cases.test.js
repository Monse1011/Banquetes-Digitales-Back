const { createResourceUseCases } = require("./create-resource-use-cases");
const {
  InMemoryResourceRepository,
} = require("../../../infrastructure/repositories/resource/in-memory-resource-repository");
const {
  InMemoryOperativeRoleRepository,
} = require("../../../infrastructure/repositories/operative-role/in-memory-operative-role-repository");
const { Resource } = require("../../../domain/entities/resource/resource");
const { OperativeRole } = require("../../../domain/entities/operative-role/operative-role");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");
const {
  ResourceMessages,
  ResourceNotFoundMessages,
  ResourceDuplicateNameMessages,
} = require("../../../domain/constants/resource-messages");
const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");
const ResourceNotFoundException = require("../../../domain/exceptions/resource/resource-not-found-exception");
const DuplicateResourceException = require("../../../domain/exceptions/resource/duplicate-resource-exception");

const CREATED_AT = new Date(2026, 8, 1, 9, 30, 0);

const WAITER_ROLE_ID = 1;
const CHEF_ROLE_ID = 2;
const INACTIVE_ROLE_ID = 3;

function humanResource(id, name, operativeRoleId, isActive = true) {
  return new Resource(
    id,
    name,
    ResourceType.HUMAN,
    operativeRoleId,
    1,
    null,
    isActive,
    CREATED_AT,
    CREATED_AT,
    isActive ? null : CREATED_AT
  );
}

function inventoryResource(id, name, type, quantity, unitCost, isActive = true) {
  return new Resource(
    id,
    name,
    type,
    null,
    quantity,
    unitCost,
    isActive,
    CREATED_AT,
    CREATED_AT,
    isActive ? null : CREATED_AT
  );
}

describe("Resource use cases (Funciones 2.8 a 2.10)", () => {
  let resourceRepository;
  let useCases;

  function setUp(resources = []) {
    resourceRepository = new InMemoryResourceRepository(resources);
    useCases = createResourceUseCases(
      resourceRepository,
      new InMemoryOperativeRoleRepository([
        new OperativeRole(WAITER_ROLE_ID, "Mesero", true),
        new OperativeRole(CHEF_ROLE_ID, "Chef", true),
        new OperativeRole(INACTIVE_ROLE_ID, "Animación", false),
      ])
    );
  }

  beforeEach(() => {
    setUp();
  });

  describe("human resources (Función 2.8)", () => {
    describe("create", () => {
      it("registers an active human resource with the trimmed name", async () => {
        const { id } = await useCases.humanResourceUseCases.create.execute({
          name: "  Ana López  ",
          operativeRoleId: WAITER_ROLE_ID,
        });

        const created = await resourceRepository.findById(id);

        expect(created.name).toBe("Ana López");
        expect(created.type).toBe(ResourceType.HUMAN);
        expect(created.isActive).toBe(true);
        expect(created.totalQuantity).toBe(1);
        expect(created.createdAt).toBeInstanceOf(Date);
      });

      it("rejects a missing name, a name over 100 characters and a missing role", async () => {
        const { create } = useCases.humanResourceUseCases;

        await expect(create.execute({ name: "   " })).rejects.toMatchObject({
          errors: {
            name: HumanResourceMessages.NAME_REQUIRED,
            operative_role_id: HumanResourceMessages.OPERATIVE_ROLE_REQUIRED,
          },
        });

        await expect(
          create.execute({ name: "a".repeat(101), operativeRoleId: WAITER_ROLE_ID })
        ).rejects.toMatchObject({ errors: { name: HumanResourceMessages.NAME_TOO_LONG } });
      });

      it("rejects inactive or unknown operative roles", async () => {
        for (const operativeRoleId of [INACTIVE_ROLE_ID, 999]) {
          await expect(
            useCases.humanResourceUseCases.create.execute({ name: "Ana López", operativeRoleId })
          ).rejects.toMatchObject({
            errors: { operative_role_id: ResourceMessages.OPERATIVE_ROLE_NOT_ACTIVE },
          });
        }
      });

      it("warns about an active duplicate and registers it only after confirmation", async () => {
        setUp([humanResource(1, "Ana López", WAITER_ROLE_ID)]);
        const { create } = useCases.humanResourceUseCases;

        await expect(
          create.execute({ name: "ana lópez", operativeRoleId: WAITER_ROLE_ID })
        ).rejects.toThrow(DuplicateResourceException);

        const { id } = await create.execute({
          name: "ana lópez",
          operativeRoleId: WAITER_ROLE_ID,
          confirmDuplicate: true,
        });

        expect(id).toBe(2);
      });

      it("does not warn when the homonym is inactive or has another role", async () => {
        setUp([
          humanResource(1, "Ana López", WAITER_ROLE_ID, false),
          humanResource(2, "Ana López", CHEF_ROLE_ID),
        ]);

        await expect(
          useCases.humanResourceUseCases.create.execute({
            name: "Ana López",
            operativeRoleId: WAITER_ROLE_ID,
          })
        ).resolves.toEqual({ id: 3 });
      });
    });

    describe("update", () => {
      it("updates the name and the operative role", async () => {
        setUp([humanResource(1, "David Torres", WAITER_ROLE_ID)]);

        await useCases.humanResourceUseCases.update.execute(1, {
          name: "David Tec",
          operativeRoleId: CHEF_ROLE_ID,
        });

        const updated = await resourceRepository.findById(1);

        expect(updated.name).toBe("David Tec");
        expect(updated.operativeRoleId).toBe(CHEF_ROLE_ID);
        expect(updated.updatedAt).not.toEqual(CREATED_AT);
      });

      it("requires both fields and rejects changing to an inactive role", async () => {
        setUp([humanResource(1, "David Torres", WAITER_ROLE_ID)]);
        const { update } = useCases.humanResourceUseCases;

        await expect(update.execute(1, { name: "David Tec" })).rejects.toThrow(
          ResourceValidationException
        );
        await expect(
          update.execute(1, { name: "David Tec", operativeRoleId: INACTIVE_ROLE_ID })
        ).rejects.toThrow(ResourceValidationException);
      });

      it("does not treat other resource types as human resources", async () => {
        setUp([inventoryResource(1, "Camioneta", ResourceType.LOGISTIC, 2, 1000)]);

        await expect(
          useCases.humanResourceUseCases.update.execute(1, {
            name: "Van",
            operativeRoleId: WAITER_ROLE_ID,
          })
        ).rejects.toThrow(new ResourceNotFoundException(ResourceNotFoundMessages.humano));
      });
    });

    describe("change status", () => {
      it("deactivates a resource logically", async () => {
        setUp([humanResource(1, "David Torres", WAITER_ROLE_ID)]);

        await useCases.humanResourceUseCases.changeStatus.execute(1, false);

        const resource = await resourceRepository.findById(1);

        expect(resource.isActive).toBe(false);
        expect(resource.deactivatedAt).toBeInstanceOf(Date);
      });

      it("reactivates a resource only if its operative role is active", async () => {
        setUp([
          humanResource(1, "David Torres", WAITER_ROLE_ID, false),
          humanResource(2, "Pedro Gómez", INACTIVE_ROLE_ID, false),
        ]);
        const { changeStatus } = useCases.humanResourceUseCases;

        await changeStatus.execute(1, true);
        const reactivated = await resourceRepository.findById(1);

        expect(reactivated.isActive).toBe(true);
        expect(reactivated.deactivatedAt).toBeNull();
        await expect(changeStatus.execute(2, true)).rejects.toThrow(ResourceValidationException);
      });

      it("requires a boolean status", async () => {
        setUp([humanResource(1, "David Torres", WAITER_ROLE_ID)]);

        await expect(
          useCases.humanResourceUseCases.changeStatus.execute(1, "false")
        ).rejects.toThrow(ResourceValidationException);
      });
    });

    describe("list", () => {
      beforeEach(() => {
        setUp([
          humanResource(1, "Carlos Ruiz", CHEF_ROLE_ID),
          humanResource(2, "Ana López", WAITER_ROLE_ID),
          humanResource(3, "Pedro Gómez", WAITER_ROLE_ID, false),
          humanResource(4, "Laura Díaz", WAITER_ROLE_ID),
          inventoryResource(5, "Cable HDMI", ResourceType.MATERIAL, 20, 150),
        ]);
      });

      it("lists active human resources alphabetically by default", async () => {
        const result = await useCases.humanResourceUseCases.getResources.execute();

        expect(result.data.resources.map((resource) => resource.name)).toEqual([
          "Ana López",
          "Carlos Ruiz",
          "Laura Díaz",
        ]);
        expect(result.data.resources[0]).toEqual({
          id: 2,
          name: "Ana López",
          type: ResourceType.HUMAN,
          operative_role_id: WAITER_ROLE_ID,
          is_active: true,
        });
        expect(result.metadata.pagination).toEqual({ total_records: 3, page: 1, per_page: 10 });
      });

      it("searches by partial name ignoring case and filters by operative role", async () => {
        const { getResources } = useCases.humanResourceUseCases;
        const byName = await getResources.execute({ filters: { name: "LÓ" } });
        const byRole = await getResources.execute({ filters: { operativeRoleId: WAITER_ROLE_ID } });

        expect(byName.data.resources.map((resource) => resource.id)).toEqual([2]);
        expect(byRole.data.resources.map((resource) => resource.id)).toEqual([2, 4]);
      });

      it("lists inactive resources, descending order and pages on request", async () => {
        const { getResources } = useCases.humanResourceUseCases;
        const inactive = await getResources.execute({ filters: { isActive: false } });
        const secondPage = await getResources.execute({
          sort: { field: "name", direction: "desc" },
          page: 2,
          perPage: 2,
        });

        expect(inactive.data.resources.map((resource) => resource.id)).toEqual([3]);
        expect(secondPage.data.resources.map((resource) => resource.name)).toEqual(["Ana López"]);
        expect(secondPage.metadata.pagination).toEqual({ total_records: 3, page: 2, per_page: 2 });
      });

      it("cannot be widened to other types through the filters", async () => {
        const result = await useCases.humanResourceUseCases.getResources.execute({
          filters: { type: ResourceType.MATERIAL },
        });

        expect(result.data.resources.every((resource) => resource.type === "humano")).toBe(true);
      });
    });

    describe("detail", () => {
      it("returns the detail with the dates in the contract format", async () => {
        setUp([humanResource(1, "David Torres", WAITER_ROLE_ID)]);

        const result = await useCases.humanResourceUseCases.getResource.execute(1);

        expect(result.data.resource).toEqual({
          id: 1,
          name: "David Torres",
          type: ResourceType.HUMAN,
          operative_role_id: WAITER_ROLE_ID,
          is_active: true,
          created_at: "2026-09-01T09:30:00",
          updated_at: "2026-09-01T09:30:00",
          deactivated_at: null,
        });
      });

      it("throws not found for unknown resources", async () => {
        await expect(useCases.humanResourceUseCases.getResource.execute(42)).rejects.toThrow(
          ResourceNotFoundException
        );
      });
    });
  });

  describe.each([
    ["material resources (Función 2.9)", "materialResourceUseCases", ResourceType.MATERIAL],
    ["logistic resources (Función 2.10)", "logisticResourceUseCases", ResourceType.LOGISTIC],
  ])("%s", (_title, useCasesKey, type) => {
    const otherType =
      type === ResourceType.MATERIAL ? ResourceType.LOGISTIC : ResourceType.MATERIAL;

    it("registers an active resource without operative role", async () => {
      const { id } = await useCases[useCasesKey].create.execute({
        name: " Cable HDMI ",
        quantity: 20,
        unitCost: 150.5,
        operativeRoleId: WAITER_ROLE_ID,
      });

      expect(await resourceRepository.findById(id)).toMatchObject({
        name: "Cable HDMI",
        type,
        operativeRoleId: null,
        totalQuantity: 20,
        unitCost: 150.5,
        isActive: true,
      });
    });

    it("rejects invalid name, quantity and unit cost", async () => {
      await expect(
        useCases[useCasesKey].create.execute({ name: "", quantity: -1, unitCost: 10.123 })
      ).rejects.toMatchObject({
        errors: {
          name: ResourceMessages.NAME_REQUIRED,
          quantity: ResourceMessages.QUANTITY_INVALID,
          unit_cost: ResourceMessages.UNIT_COST_INVALID,
        },
      });
    });

    it("updates name, quantity and unit cost", async () => {
      setUp([inventoryResource(1, "Cable", type, 20, 150)]);

      await useCases[useCasesKey].update.execute(1, {
        name: "Cable HDMI 2.1",
        quantity: 25,
        unitCost: 180,
      });

      expect(await resourceRepository.findById(1)).toMatchObject({
        name: "Cable HDMI 2.1",
        totalQuantity: 25,
        unitCost: 180,
        operativeRoleId: null,
      });
    });

    it("rejects a name already used by a resource of the same type, even inactive", async () => {
      setUp([
        inventoryResource(1, "Mesas", type, 4, 1000, false),
        inventoryResource(2, "Sillas", type, 50, 20),
        inventoryResource(3, "Carpa", otherType, 1, 500),
      ]);
      const { create, update } = useCases[useCasesKey];
      const duplicateError = { errors: { name: ResourceDuplicateNameMessages[type] } };

      await expect(
        create.execute({ name: " MESAS ", quantity: 1, unitCost: 1 })
      ).rejects.toMatchObject(duplicateError);
      await expect(
        update.execute(2, { name: "mesas", quantity: 1, unitCost: 1 })
      ).rejects.toMatchObject(duplicateError);
    });

    it("allows keeping its own name and reusing names of other types", async () => {
      setUp([
        inventoryResource(1, "Sillas", type, 50, 20),
        inventoryResource(2, "Carpa", otherType, 1, 500),
      ]);
      const { create, update } = useCases[useCasesKey];

      await update.execute(1, { name: "SILLAS", quantity: 60, unitCost: 20 });
      const { id } = await create.execute({ name: "Carpa", quantity: 1, unitCost: 500 });

      expect((await resourceRepository.findById(1)).name).toBe("SILLAS");
      expect((await resourceRepository.findById(id)).type).toBe(type);
    });

    it("deactivates and reactivates a resource without operative role", async () => {
      setUp([inventoryResource(1, "Cable", type, 20, 150)]);
      const { changeStatus } = useCases[useCasesKey];

      await changeStatus.execute(1, false);
      expect((await resourceRepository.findById(1)).isActive).toBe(false);

      await changeStatus.execute(1, true);
      expect((await resourceRepository.findById(1)).isActive).toBe(true);
    });

    it("lists and details only its own type", async () => {
      setUp([
        inventoryResource(1, "Mesas", type, 4, 1000),
        inventoryResource(2, "Camioneta", otherType, 2, 1000),
        humanResource(3, "Ana López", WAITER_ROLE_ID),
      ]);

      const list = await useCases[useCasesKey].getResources.execute();

      expect(list.data.resources).toEqual([
        {
          id: 1,
          name: "Mesas",
          type,
          quantity: 4,
          unit_cost: 1000,
          is_active: true,
        },
      ]);
      expect((await useCases[useCasesKey].getResource.execute(1)).data.resource).toMatchObject({
        id: 1,
        quantity: 4,
        unit_cost: 1000,
        created_at: "2026-09-01T09:30:00",
        deactivated_at: null,
      });
      await expect(useCases[useCasesKey].getResource.execute(2)).rejects.toThrow(
        new ResourceNotFoundException(ResourceNotFoundMessages[type])
      );
    });
  });

  describe("resources by type (Ver recursos por tipo)", () => {
    it("lists every type unless a type filter is sent", async () => {
      setUp([
        inventoryResource(1, "Mesas", ResourceType.LOGISTIC, 4, 1000),
        inventoryResource(2, "Cable", ResourceType.MATERIAL, 20, 150),
        humanResource(3, "Ana López", WAITER_ROLE_ID),
      ]);
      const { getResources } = useCases.resourceUseCases;

      const all = await getResources.execute();
      const humans = await getResources.execute({ filters: { type: ResourceType.HUMAN } });

      expect(all.data.resources.map((resource) => resource.id)).toEqual([3, 2, 1]);
      expect(humans.data.resources.map((resource) => resource.id)).toEqual([3]);
    });
  });
});
