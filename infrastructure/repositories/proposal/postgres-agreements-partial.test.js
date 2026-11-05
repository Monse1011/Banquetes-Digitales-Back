const { Pool } = require("pg");
const { PostgresResourceRepository } = require("../resource/postgres-resource-repository");
const {
  PostgresOperativeRoleRepository,
} = require("../operative-role/postgres-operative-role-repository");
const {
  PostgresResourceAssignmentRepository,
} = require("../resource-assignment/postgres-resource-assignment-repository");
const {
  PostgresResourceConfirmationRepository,
} = require("../resource-assignment/postgres-resource-confirmation-repository");
const PostgresUserRepository = require("../auth/postgres-user-repository");
const {
  PostgresTransactionManager,
} = require("../../services/transaction/postgres-transaction-manager");
const { ConfirmedResourceAdapter } = require("./confirmed-resource-adapter");
const {
  PostgresDerivedInformationRepository,
} = require("./postgres-derived-information-repository");
const {
  PostgresReservationRequestRepository,
} = require("../reservation-request/postgres-reservation-request-repository");
const {
  SaveAgreementsUseCase,
} = require("../../../application/use-cases/proposal/save-agreements-use-case");
const {
  SaveAgreementsRequestDto,
} = require("../../../application/dto/proposal/save-agreements-request-dto");
const {
  createResourceUseCases,
} = require("../../../application/use-cases/resource/create-resource-use-cases");
const {
  createResourceAssignmentUseCases,
} = require("../../../application/use-cases/resource-assignment/create-resource-assignment-use-cases");
const AgreementsValidationException = require("../../../domain/exceptions/proposal/agreements-validation-exception");

// Defecto 8 con el cableado de producción (ConfirmedResourceAdapter sobre PostgreSQL): una
// solicitud con una persona, material y logística. Omitir un recurso lo deja sin cambios y
// liberarlo es explícito con cantidad 0. Todo se revierte al terminar.
describe.skipIf(!process.env.TEST_PGDATABASE)("Acuerdos con recursos parciales (defecto 8)", () => {
  let pool;
  let connection;
  let ctx;

  beforeEach(async () => {
    pool = new Pool({ database: process.env.TEST_PGDATABASE });
    connection = await pool.connect();
    await connection.query("BEGIN");
    const adapter = {
      query: (sql, values) =>
        connection.query(
          {
            BEGIN: "SAVEPOINT repository_transaction",
            COMMIT: "RELEASE SAVEPOINT repository_transaction",
            ROLLBACK: "ROLLBACK TO SAVEPOINT repository_transaction",
          }[sql] ?? sql,
          values
        ),
      release() {},
    };
    adapter.connect = async () => adapter;

    const tag = Date.now();
    const q = async (sql, values) => (await connection.query(sql, values)).rows[0];
    const logistic = await q(
      "INSERT INTO users (id_employee,full_name,email,password_hash,role,status) VALUES ($1,'Logistica P',$2,'x','LOGISTICS','ACTIVE') RETURNING id_user",
      [`TP${tag}`, `p-${tag}@example.invalid`]
    );
    const client = await q(
      "INSERT INTO clients (full_name,email,phone) VALUES ('Cliente P',$1,'9991234567') RETURNING id",
      [`cp-${tag}@example.invalid`]
    );
    const request = await q(
      `INSERT INTO reservations_request (folio, client_id, logistic_user_id, event_date, event_time,
         event_end_time, guest_count, event_address, status)
       VALUES ('BD-2035-88888', $1, $2, '2035-06-01', '18:00', '2035-06-01T23:00:00-06:00', 50,
         'Salón P', 'ASSIGNED') RETURNING id`,
      [client.id, logistic.id_user]
    );
    const resourceRepo = new PostgresResourceRepository(adapter);
    const roleRepo = new PostgresOperativeRoleRepository(adapter);
    const catalog = createResourceUseCases(resourceRepo, roleRepo);
    const material = await catalog.materialResourceUseCases.create.execute({
      name: `Vajilla ${tag}`,
      quantity: 10,
      unitCost: 5,
    });
    const [role] = await roleRepo.findActive();
    const person = await catalog.humanResourceUseCases.create.execute({
      name: `Mesera ${tag}`,
      operativeRoleId: role.id,
      precio: 50,
    });
    const vehicle = await catalog.logisticResourceUseCases.create.execute({
      name: `Camioneta ${tag}`,
      quantity: 2,
      unitCost: 100,
    });
    const requests = new PostgresReservationRequestRepository(adapter);
    const assignments = new PostgresResourceAssignmentRepository(adapter);
    const { resourceAssignmentUseCases: operations } = createResourceAssignmentUseCases(
      resourceRepo,
      requests,
      assignments,
      new PostgresResourceConfirmationRepository(adapter),
      roleRepo,
      new PostgresUserRepository(adapter),
      new PostgresTransactionManager(adapter)
    );
    const actor = { id: Number(logistic.id_user), role: "LOGISTICS" };
    const requestId = Number(request.id);

    await operations.assignResources.execute(requestId, actor, {
      data: [
        { resource_id: person.id, quantity: 1 },
        { resource_id: material.id, quantity: 3 },
        { resource_id: vehicle.id, quantity: 1 },
      ],
    });
    await operations.confirmResources.execute(requestId, actor, {});

    const agreementResources = new ConfirmedResourceAdapter(assignments, resourceRepo);
    ctx = {
      requestId,
      actor,
      person,
      material,
      vehicle,
      vehicleName: `Camioneta ${tag}`,
      catalog,
      agreementResources,
      save: (adjusted) =>
        new SaveAgreementsUseCase(
          requests,
          agreementResources,
          new PostgresDerivedInformationRepository(adapter),
          new PostgresTransactionManager(adapter)
        ).execute(
          requestId,
          actor.id,
          new SaveAgreementsRequestDto({
            location: "Salón P",
            start_datetime: "2035-06-01T18:00:00-06:00",
            end_datetime: "2035-06-01T23:00:00-06:00",
            adjusted_resources: adjusted,
          })
        ),
      active: async () =>
        Object.fromEntries(
          (await agreementResources.findActiveByRequestId(requestId)).map((assignment) => [
            assignment.resourceId,
            assignment.quantity,
          ])
        ),
    };
  });

  afterEach(async () => {
    await connection.query("ROLLBACK");
    connection.release();
    await pool.end();
  });

  const all = (overrides = {}) => ({
    [ctx.person.id]: 1,
    [ctx.material.id]: 3,
    [ctx.vehicle.id]: 1,
    ...overrides,
  });

  it("mandar solo materiales conserva al personal y la logística", async () => {
    await ctx.save([{ resource_id: ctx.material.id, quantity: 4 }]);

    expect(await ctx.active()).toEqual(all({ [ctx.material.id]: 4 }));
  });

  it("liberar a una persona explícitamente con cantidad 0 funciona", async () => {
    await ctx.save([{ resource_id: ctx.person.id, quantity: 0 }]);

    expect(await ctx.active()).toEqual({ [ctx.material.id]: 3, [ctx.vehicle.id]: 1 });
  });

  it("liberar y volver a agregar funciona (persona y logística)", async () => {
    await ctx.save([
      { resource_id: ctx.person.id, quantity: 0 },
      { resource_id: ctx.vehicle.id, quantity: 0 },
    ]);
    expect(await ctx.active()).toEqual({ [ctx.material.id]: 3 });

    await ctx.save([
      { resource_id: ctx.person.id, quantity: 1 },
      { resource_id: ctx.vehicle.id, quantity: 1 },
    ]);
    expect(await ctx.active()).toEqual(all());
  });

  it("un recurso omitido se revalida y el error lo nombra con el motivo", async () => {
    await ctx.catalog.logisticResourceUseCases.changeStatus.execute(ctx.vehicle.id, false);

    const error = await ctx.save([{ resource_id: ctx.material.id, quantity: 4 }]).catch((e) => e);

    expect(error.name).toBe("ResourceAvailabilityExceededException");
    expect(error.conflicts).toEqual([
      expect.objectContaining({
        resource_id: ctx.vehicle.id,
        message: `${ctx.vehicleName} no se modificó, pero su cantidad asignada (1) ya no está disponible para el horario indicado (disponible: 0).`,
      }),
    ]);
    expect(await ctx.active()).toEqual(all());
  });

  it("un error de validación devuelve mensajes específicos y no cambia las asignaciones", async () => {
    await expect(
      ctx.save([
        { resource_id: ctx.vehicle.id, quantity: 0 },
        { resource_id: 999999, quantity: 1 },
      ])
    ).rejects.toMatchObject({
      constructor: AgreementsValidationException,
      message: "El recurso con identificador 999999 no está asignado a la solicitud.",
    });
    expect(await ctx.active()).toEqual(all());
  });
});
