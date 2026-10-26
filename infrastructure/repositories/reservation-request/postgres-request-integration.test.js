const { Pool } = require("pg");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  GetReservationRequestsUseCase,
} = require("../../../application/use-cases/reservation-request/get-reservation-requests-use-case");
const {
  CancelEventUseCase,
} = require("../../../application/use-cases/calendar/cancel-event-use-case");
const { EditEventUseCase } = require("../../../application/use-cases/calendar/edit-event-use-case");
const {
  createResourceUseCases,
} = require("../../../application/use-cases/resource/create-resource-use-cases");
const {
  createResourceAssignmentUseCases,
} = require("../../../application/use-cases/resource-assignment/create-resource-assignment-use-cases");
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
const { ConfirmedResourceAdapter } = require("../proposal/confirmed-resource-adapter");
const {
  PostgresDerivedInformationRepository,
} = require("../proposal/postgres-derived-information-repository");
const {
  GetRequestAgreementsUseCase,
} = require("../../../application/use-cases/proposal/get-request-agreements-use-case");
const {
  SaveAgreementsUseCase,
} = require("../../../application/use-cases/proposal/save-agreements-use-case");
const {
  SaveAgreementsRequestDto,
} = require("../../../application/dto/proposal/save-agreements-request-dto");
const { PostgresProposalRepository } = require("../proposal/postgres-proposal-repository");
const { PdfkitPdfGenerator } = require("../../services/proposal/pdfkit-pdf-generator");
const {
  GenerateProposalUseCase,
} = require("../../../application/use-cases/proposal/generate-proposal-use-case");
const {
  GetProposalUseCase,
} = require("../../../application/use-cases/proposal/get-proposal-use-case");
const {
  DownloadProposalUseCase,
} = require("../../../application/use-cases/proposal/download-proposal-use-case");
const {
  GenerateProposalRequestDto,
} = require("../../../application/dto/proposal/generate-proposal-request-dto");
const ListAssignedRequestsUseCase = require("../../../application/use-cases/logistics/list-assigned-requests-use-case");
const GetAssignedRequestsHistoryUseCase = require("../../../application/use-cases/logistics/get-assigned-requests-history-use-case");
const GetAssignedRequestDetailUseCase = require("../../../application/use-cases/logistics/get-assigned-request-detail-use-case");
const { PostgresClientRepository } = require("../client/postgres-client-repository");
const { PostgresServiceRepository } = require("../service/postgres-service-repository");
const {
  PostgresReservationRequestRepository,
} = require("./postgres-reservation-request-repository");
const {
  PostgresAdminRequestQueryRepository,
} = require("./postgres-admin-request-query-repository");
const {
  PostgresCalendarEventRepository,
} = require("../calendar/postgres-calendar-event-repository");
const PostgresFolioGenerator = require("../../services/reservation-request/postgres-folio-generator");
const { Client } = require("../../../domain/entities/client/client");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");

const {
  ScheduleEventUseCase,
} = require("../../../application/use-cases/calendar/schedule-event-use-case");
const {
  ListCalendarEventsUseCase,
} = require("../../../application/use-cases/calendar/list-calendar-events-use-case");

// Opt-in: TEST_PGDATABASE must name a database with the versioned migrations installed.
// All fixtures roll back. Repository transactions become savepoints inside the outer test
// transaction, so their rollbacks still apply; commit semantics are not tested here.
describe.skipIf(!process.env.TEST_PGDATABASE)("Request repositories against PostgreSQL", () => {
  it("creates, reads, filters and approves a request using the installed schema", async () => {
    const pool = new Pool({ database: process.env.TEST_PGDATABASE });
    const connection = await pool.connect();
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
    try {
      const clients = new PostgresClientRepository(adapter);
      const services = new PostgresServiceRepository(adapter);
      const requests = new PostgresReservationRequestRepository(adapter);
      const now = new Date();
      const client = await clients.create(
        new Client(
          null,
          "Prueba Integracion",
          `integration-${Date.now()}@example.invalid`,
          "9991234567",
          now
        )
      );
      expect((await clients.findByIds([client.clientId]))[0].clientId).toBe(client.clientId);
      const catalog = await services.findAll();
      expect(catalog.length).toBeGreaterThan(0);
      const start = new Date("2035-06-01T18:00:00-06:00");
      const end = new Date("2035-06-02T01:00:00-06:00");
      const folio = await new PostgresFolioGenerator(adapter).generate();
      const created = await requests.create(
        new ReservationRequest(
          null,
          folio,
          client.clientId,
          null,
          start,
          end,
          50,
          "Direccion de prueba",
          ReservationRequestStatus.PENDING,
          now,
          [Number(catalog[0].id)],
          null,
          null,
          null
        )
      );
      const stored = await requests.findById(created.requestId);
      expect(stored.eventDateTime.toISOString()).toBe(start.toISOString());
      expect(stored.eventEndTime.toISOString()).toBe(end.toISOString());
      expect(stored.servicesIds).toEqual([Number(catalog[0].id)]);
      expect(stored.status).toBe(ReservationRequestStatus.PENDING);
      const listed = await requests.findAll({
        clientName: "Prueba Integracion",
        status: ReservationRequestStatus.PENDING,
      });
      expect(listed.requests.some((r) => r.requestId === created.requestId)).toBe(true);
      const summary = await new GetReservationRequestsUseCase(
        new PostgresAdminRequestQueryRepository(adapter)
      ).execute({
        filters: { search: "Prueba Integracion", statuses: [ReservationRequestStatus.PENDING] },
      });
      expect(
        summary.data.find((row) => row.request_id === created.requestId).selected_services
      ).toEqual([catalog[0].name]);
      stored.status = ReservationRequestStatus.APPROVED;
      await requests.update(stored);
      expect((await requests.findById(created.requestId)).status).toBe(
        ReservationRequestStatus.APPROVED
      );
      const admin = (
        await connection.query(
          "INSERT INTO users (id_employee,full_name,email,password_hash,role,status) VALUES ($1,'Prueba Admin',$2,'unused-test-hash','ADMIN','ACTIVE') RETURNING id_user",
          [`A${Date.now()}`, `admin-${Date.now()}@example.invalid`]
        )
      ).rows[0];
      const logistic = (
        await connection.query(
          "INSERT INTO users (id_employee,full_name,email,password_hash,role,status) VALUES ($1,'Prueba Logistica',$2,'unused-test-hash','LOGISTICS','ACTIVE') RETURNING id_user",
          [`T${Date.now()}`, `logistics-${Date.now()}@example.invalid`]
        )
      ).rows[0];
      expect(await requests.assign(created.requestId, logistic.id_user, admin.id_user)).toEqual({
        status: "assigned",
      });
      const active = new ListAssignedRequestsUseCase({ reservationRequestRepository: requests });
      expect(
        (await active.execute({ userId: logistic.id_user })).data.requests.map((r) => r.request_id)
      ).toEqual([created.requestId]);
      expect(
        (await active.execute({ userId: logistic.id_user, status: "ASSIGNED" })).data.requests
      ).toHaveLength(1);
      const detail = new GetAssignedRequestDetailUseCase({
        reservationRequestRepository: requests,
        serviceRepository: services,
      });
      expect(
        (await detail.execute({ requestId: created.requestId, userId: logistic.id_user })).data
          .folio
      ).toBe(folio);
      const detailData = (
        await detail.execute({ requestId: created.requestId, userId: logistic.id_user })
      ).data;
      expect(detailData.selected_services).toEqual([
        {
          service_id: catalog[0].id,
          service_name: catalog[0].name,
          required_resources: [],
        },
      ]);
      await expect(
        detail.execute({ requestId: created.requestId, userId: admin.id_user })
      ).rejects.toMatchObject({ status: 403 });
      const other = await active.execute({ userId: admin.id_user });
      expect(other.data.requests.some((r) => r.request_id === created.requestId)).toBe(false);
      const resourceRepo = new PostgresResourceRepository(adapter);
      const roleRepo = new PostgresOperativeRoleRepository(adapter);
      const roles = await roleRepo.findActive();
      expect(roles.length).toBeGreaterThan(0);
      const catalogCases = createResourceUseCases(resourceRepo, roleRepo);
      const human = await catalogCases.humanResourceUseCases.create.execute({
        name: `Persona prueba ${Date.now()}`,
        operativeRoleId: roles[0].id,
      });
      const material = await catalogCases.materialResourceUseCases.create.execute({
        name: `Material prueba ${Date.now()}`,
        quantity: 10,
        unitCost: 5,
      });
      const vehicle = await catalogCases.logisticResourceUseCases.create.execute({
        name: `Logistico prueba ${Date.now()}`,
        quantity: 2,
        unitCost: 100,
      });
      await catalogCases.materialResourceUseCases.update.execute(material.id, {
        name: `Material editado ${Date.now()}`,
        quantity: 12,
        unitCost: 6,
      });
      expect((await resourceRepo.findById(material.id)).totalQuantity).toBe(12);
      await catalogCases.logisticResourceUseCases.changeStatus.execute(vehicle.id, false);
      expect((await resourceRepo.findById(vehicle.id)).isActive).toBe(false);
      await catalogCases.logisticResourceUseCases.changeStatus.execute(vehicle.id, true);
      const sharedAssignments = new PostgresResourceAssignmentRepository(adapter);
      const { resourceAssignmentUseCases: operations } = createResourceAssignmentUseCases(
        resourceRepo,
        requests,
        sharedAssignments,
        new PostgresResourceConfirmationRepository(adapter),
        roleRepo,
        new PostgresUserRepository(adapter),
        new PostgresTransactionManager(adapter)
      );
      const actor = { id: Number(logistic.id_user), role: "LOGISTICS" };
      await operations.assignResources.execute(created.requestId, actor, {
        data: [
          { resource_id: human.id, quantity: 1 },
          { resource_id: material.id, quantity: 3 },
        ],
      });
      const availability = await operations.getAvailability.execute(
        created.requestId,
        actor,
        "MATERIAL",
        { perPage: 100 }
      );
      expect(
        availability.data.resources.find((r) => r.id === material.id).assignment
      ).toMatchObject({ requested_quantity: 3, assigned_quantity: 3, status: "Provisional" });
      await operations.releaseResource.execute(created.requestId, actor, material.id);
      await operations.assignResources.execute(created.requestId, actor, {
        data: [{ resource_id: material.id, quantity: 3 }],
      });
      // Exercise incomplete coordination with the actual mixed backend wiring:
      // resource catalog/request in PostgreSQL; existing assignments remain in memory.
      await operations.assignResources.execute(created.requestId, actor, {
        data: [{ resource_id: material.id, quantity: 30, observation: "Faltan sillas" }],
      });
      const incomplete = await operations.confirmResources.execute(created.requestId, actor, {
        observations: "Revisar cantidades",
      });
      expect(incomplete.data.current_status).toBe(ReservationRequestStatus.COORDINATION_INCOMPLETE);
      expect((await requests.findById(created.requestId)).status).toBe(
        ReservationRequestStatus.COORDINATION_INCOMPLETE
      );
      const incompleteResources = await operations.getAvailability.execute(
        created.requestId,
        actor,
        "MATERIAL",
        { perPage: 100 }
      );
      expect(
        incompleteResources.data.resources.find((r) => r.id === material.id).assignment
      ).toMatchObject({ sufficiency: "Insuficiente", observation: "Faltan sillas" });
      await operations.assignResources.execute(created.requestId, actor, {
        data: [{ resource_id: material.id, quantity: 3 }],
      });
      const confirmed = await operations.confirmResources.execute(created.requestId, actor, {
        observations: "Prueba de integracion",
      });
      expect(confirmed.data.current_status).toBe(ReservationRequestStatus.COORDINATION_READY);
      expect((await requests.findById(created.requestId)).status).toBe(
        ReservationRequestStatus.COORDINATION_READY
      );
      const agreementResources = new ConfirmedResourceAdapter(sharedAssignments, resourceRepo);
      const derived = new PostgresDerivedInformationRepository(adapter);
      const loadAgreements = new GetRequestAgreementsUseCase(
        requests,
        clients,
        agreementResources,
        derived
      );
      const saveAgreements = new SaveAgreementsUseCase(
        requests,
        agreementResources,
        derived,
        new PostgresTransactionManager(adapter)
      );
      const beforeAgreements = await loadAgreements.execute(created.requestId, actor.id);
      expect(beforeAgreements.data.assigned_resources).toHaveLength(2);
      const agreementDto = new SaveAgreementsRequestDto({
        location: "Lugar confirmado",
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        observations: "Observacion conservada",
        adjusted_resources: [
          { resource_id: human.id, quantity: 1 },
          { resource_id: material.id, quantity: 4 },
        ],
      });
      const savedAgreement = await saveAgreements.execute(
        created.requestId,
        actor.id,
        agreementDto
      );
      expect(savedAgreement.data.derived_information_id).toBeGreaterThan(0);
      const afterAgreements = await loadAgreements.execute(created.requestId, actor.id);
      expect(afterAgreements.data).toMatchObject({
        location: "Lugar confirmado",
        observations: "Observacion conservada",
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: ReservationRequestStatus.COORDINATION_READY,
      });
      expect(
        afterAgreements.data.assigned_resources.find((r) => r.resource_id === material.id).quantity
      ).toBe(4);
      const failingSave = new SaveAgreementsUseCase(
        requests,
        agreementResources,
        {
          lockRequest: (...args) => derived.lockRequest(...args),
          create: async () => {
            throw new Error("Simulated save failure");
          },
        },
        new PostgresTransactionManager(adapter)
      );
      const failedDto = new SaveAgreementsRequestDto({
        location: "No guardar",
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        adjusted_resources: [
          { resource_id: human.id, quantity: 1 },
          { resource_id: material.id, quantity: 5 },
        ],
      });
      await expect(failingSave.execute(created.requestId, actor.id, failedDto)).rejects.toThrow(
        "Simulated save failure"
      );
      expect(
        (await agreementResources.findActiveByRequestId(created.requestId)).find(
          (r) => r.resourceId === material.id
        ).quantity
      ).toBe(4);
      await expect(
        saveAgreements.execute(
          created.requestId,
          actor.id,
          new SaveAgreementsRequestDto({
            ...{
              location: "No guardar",
              start_datetime: start.toISOString(),
              end_datetime: end.toISOString(),
              adjusted_resources: [
                { resource_id: human.id, quantity: 1 },
                { resource_id: material.id, quantity: 999 },
              ],
            },
          })
        )
      ).rejects.toThrow();
      expect((await loadAgreements.execute(created.requestId, actor.id)).data.location).toBe(
        "Lugar confirmado"
      );
      const pdfDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "banquetes-proposal-test-"));
      try {
        const proposals = new PostgresProposalRepository(adapter);
        const pdf = new PdfkitPdfGenerator({ storageDir: pdfDirectory });
        const generation = new GenerateProposalUseCase(
          requests,
          clients,
          derived,
          proposals,
          agreementResources,
          pdf
        );
        const input = new GenerateProposalRequestDto({
          derived_information_id: savedAgreement.data.derived_information_id,
        });
        const generated = await generation.execute(created.requestId, actor.id, input);
        expect(generated.data.request_status).toBe(ReservationRequestStatus.PROPOSAL_GENERATED);
        const storedProposal = await new GetProposalUseCase(requests, proposals).execute(
          created.requestId,
          actor.id
        );
        expect(storedProposal.data.proposal_id).toBe(generated.data.proposal_id);
        const document = await new DownloadProposalUseCase(requests, proposals, pdf).execute(
          created.requestId,
          actor.id
        );
        expect(document.buffer.subarray(0, 5).toString()).toBe("%PDF-");
        expect(document.buffer.length).toBeGreaterThan(1000);
        const amounts = (
          await connection.query("SELECT subtotal, total_amount FROM proposals WHERE id=$1", [
            generated.data.proposal_id,
          ])
        ).rows[0];
        expect(Number(amounts.subtotal)).toBe(24);
        expect(Number(amounts.total_amount)).toBe(24);
        expect(
          (
            await connection.query(
              "SELECT resource_id FROM proposal_resources WHERE proposal_id=$1",
              [generated.data.proposal_id]
            )
          ).rows
        ).toHaveLength(2);
        await expect(generation.execute(created.requestId, actor.id, input)).rejects.toThrow();
        const calendar = new PostgresCalendarEventRepository(adapter);
        const schedule = new ScheduleEventUseCase(requests, clients, calendar, null);
        // Calendar must consume the proposal's persisted resources, even after memory is lost.
        const resourceIds = (
          await connection.query(
            "SELECT resource_id FROM proposal_resources WHERE proposal_id=$1",
            [generated.data.proposal_id]
          )
        ).rows.map((row) => row.resource_id);
        await connection.query(
          "UPDATE resources SET is_active=false, deactivated_at=NOW() WHERE id=$1",
          [resourceIds[0]]
        );
        await expect(schedule.execute(created.requestId, actor)).rejects.toThrow();
        expect((await requests.findById(created.requestId)).status).toBe(
          ReservationRequestStatus.PROPOSAL_GENERATED
        );
        await connection.query(
          "UPDATE resources SET is_active=true, deactivated_at=NULL WHERE id=$1",
          [resourceIds[0]]
        );
        // The original request may differ from the final agreed location and schedule.
        await connection.query(
          "UPDATE reservations_request SET event_date=event_date+1, event_end_time=event_end_time + interval '1 day' WHERE id=$1",
          [created.requestId]
        );
        const scheduled = await schedule.execute(created.requestId, actor);
        expect(scheduled.event.status).toBe(ReservationRequestStatus.CONFIRMED);
        expect(scheduled.event.location).toBe("Lugar confirmado");
        expect(scheduled.event.startAt.toISOString()).toBe(start.toISOString());
        expect(scheduled.event.endAt.toISOString()).toBe(end.toISOString());
        expect(
          (await new GetProposalUseCase(requests, proposals).execute(created.requestId, actor.id))
            .data.status
        ).toBe("accepted");
        await expect(schedule.execute(created.requestId, actor)).rejects.toThrow();
        const listCalendar = new ListCalendarEventsUseCase(calendar);
        const listedCalendar = await listCalendar.execute({ actor });
        expect(listedCalendar.events.map((event) => event.request_id)).toEqual([created.requestId]);
        expect(
          (await listCalendar.execute({ actor: { id: -1, role: "LOGISTICS" } })).events
        ).toHaveLength(0);
        expect(
          (
            await listCalendar.execute({ actor: { id: Number(admin.id_user), role: "ADMIN" } })
          ).events.some((event) => event.request_id === created.requestId)
        ).toBe(true);
        expect(
          (
            await connection.query(
              "SELECT COUNT(*)::int AS count FROM calendar_sync_outbox WHERE calendar_event_id=$1",
              [scheduled.event.id]
            )
          ).rows[0].count
        ).toBe(1);
        const edit = new EditEventUseCase(calendar, null);
        const cancel = new CancelEventUseCase(calendar, null);
        const editedStart = new Date(start.getTime() + 86400000);
        const editedEnd = new Date(end.getTime() + 86400000);
        await edit.execute(scheduled.event.id, actor, {
          location: "Lugar editado",
          start_datetime: editedStart.toISOString(),
          end_datetime: editedEnd.toISOString(),
        });
        const edited = await calendar.findById(scheduled.event.id);
        expect(edited.location).toBe("Lugar editado");
        expect(edited.startAt.toISOString()).toBe(editedStart.toISOString());
        expect((await requests.findById(created.requestId)).eventAddress).toBe("Lugar editado");
        await connection.query(
          `INSERT INTO assigned_resources (request_id,resource_id,requested_quantity,quantity,sufficiency,usage_start,usage_end,event_start,event_end,status)
           VALUES ($1,$2,1,1,$5,$3,$4,$3,$4,$6)`,
          [
            created.requestId,
            resourceIds[0],
            editedStart,
            editedEnd,
            ResourceSufficiency.SUFFICIENT,
            AssignmentStatus.CONFIRMED,
          ]
        );
        await cancel.execute(scheduled.event.id, actor);
        expect((await calendar.findById(scheduled.event.id)).status).toBe(
          ReservationRequestStatus.CANCELED
        );
        const released = (
          await connection.query(
            "SELECT status,released_at FROM assigned_resources WHERE request_id=$1",
            [created.requestId]
          )
        ).rows;
        // Cancelar libera todas las asignaciones de la solicitud, incluidas las de la Función 3.2.
        expect(released.length).toBeGreaterThan(1);
        expect(released).toEqual(
          released.map(() => ({ status: AssignmentStatus.RELEASED, released_at: expect.any(Date) }))
        );
        expect((await listCalendar.execute({ actor })).events).toHaveLength(0);
        await expect(
          edit.execute(scheduled.event.id, actor, { location: "No permitido" })
        ).rejects.toThrow();
        await expect(cancel.execute(scheduled.event.id, actor)).rejects.toThrow();
        const queuedOperations = (
          await connection.query(
            "SELECT operation FROM calendar_sync_outbox WHERE calendar_event_id=$1 ORDER BY id_outbox",
            [scheduled.event.id]
          )
        ).rows.map((r) => r.operation);
        expect(queuedOperations).toEqual(["CREATE", "UPDATE", "DELETE"]);
      } finally {
        await fs.rm(pdfDirectory, { recursive: true, force: true });
      }
      await connection.query("UPDATE reservations_request SET status='FINISHED' WHERE id=$1", [
        created.requestId,
      ]);
      const history = new GetAssignedRequestsHistoryUseCase({
        reservationRequestRepository: requests,
      });
      expect(
        (await history.execute({ userId: logistic.id_user })).data.requests.map((r) => r.request_id)
      ).toEqual([created.requestId]);
      expect((await active.execute({ userId: logistic.id_user })).data.requests).toHaveLength(0);
      expect(await new PostgresCalendarEventRepository(adapter).finalizeElapsed(now)).toBe(0);
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
      await pool.end();
    }
  });
});
