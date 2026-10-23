const { Pool } = require("pg");
const { randomUUID } = require("crypto");
const {
  PostgresDerivedInformationRepository,
} = require("./postgres-derived-information-repository");
const { PostgresProposalRepository } = require("./postgres-proposal-repository");
const {
  PostgresTransactionManager,
} = require("../../services/transaction/postgres-transaction-manager");
const { ConfirmedResourceAdapter } = require("./confirmed-resource-adapter");
const {
  PostgresResourceAssignmentRepository,
} = require("../resource-assignment/postgres-resource-assignment-repository");
const {
  ResourceAssignment,
} = require("../../../domain/entities/resource-assignment/resource-assignment");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const { fromDatabaseStatus } = require("../reservation-request/postgres-request-status");
const {
  SaveAgreementsUseCase,
} = require("../../../application/use-cases/proposal/save-agreements-use-case");
const {
  GetRequestAgreementsUseCase,
} = require("../../../application/use-cases/proposal/get-request-agreements-use-case");
const {
  GenerateProposalUseCase,
} = require("../../../application/use-cases/proposal/generate-proposal-use-case");
const {
  SaveAgreementsRequestDto,
} = require("../../../application/dto/proposal/save-agreements-request-dto");
const {
  GenerateProposalRequestDto,
} = require("../../../application/dto/proposal/generate-proposal-request-dto");

function gate() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Opt-in. Real commits and independent connections in a unique disposable schema.
// The current resource wrapper is consumed unchanged; no production data or PDF is used.
describe.skipIf(!process.env.TEST_PGDATABASE)(
  "Agreement revisions with concurrent PostgreSQL transactions",
  () => {
    let admin; 
    let pool; 
    let schema; 
    let derived; 
    let proposals; 
    let adapter; 
    let save; 
    let get; 
    let generate; 
    let pdf;
    const start = new Date("2035-06-02T00:00:00Z");
    const end = new Date("2035-06-02T04:00:00Z");
    beforeEach(async () => {
      schema = `agreements_test_${randomUUID().replaceAll("-", "")}`;
      admin = new Pool({ database: process.env.TEST_PGDATABASE });
      await admin.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({
        database: process.env.TEST_PGDATABASE,
        options: `-c search_path=${schema} -c statement_timeout=5000`,
        application_name: schema,
      });
      await pool.query(`
      CREATE TABLE reservations_request (id bigint PRIMARY KEY, status text);
      CREATE TABLE derived_information (id bigserial PRIMARY KEY, request_id bigint,
        location text, start_datetime timestamptz, end_datetime timestamptz,
        observations text, created_by_user_id bigint, created_at timestamptz DEFAULT now());
      CREATE TABLE document_counters (kind text, year integer, last_number integer, PRIMARY KEY(kind, year));
      CREATE TABLE proposals (id bigserial PRIMARY KEY, request_id bigint UNIQUE, derived_information_id bigint,
        proposal_code text, file_name text, status text, subtotal numeric, discount_amount numeric,
        client_observations text, created_by_user_id bigint, created_at timestamptz);
      CREATE TABLE proposal_resources (proposal_id bigint, resource_id bigint, quantity integer, unit_cost numeric);
      INSERT INTO reservations_request VALUES (1, 'COORDINATION_READY');
    `);
      const requests = {
        findById: async (id, transaction) => {
          const row = (
            await (transaction?.connection ?? pool).query(
              "SELECT status FROM reservations_request WHERE id=$1",
              [id]
            )
          ).rows[0];
          return {
            requestId: id,
            folio: "REV-TEST",
            clientId: 1,
            logisticUserId: 9,
            status: fromDatabaseStatus(row.status),
            eventDateTime: start,
            eventEndTime: end,
            eventAddress: "Lugar original",
          };
        },
        findOverlappingByLogisticUser: async () => [],
      };
      const clients = { findById: async () => ({ fullName: "Cliente de prueba" }) };
      const resources = {
        findByIds: async () => [
          {
            id: 7,
            name: "Sillas",
            type: "MATERIAL",
            totalQuantity: 30,
            unitCost: 5,
            isActive: true,
          },
        ],
      };
      const assignments = new PostgresResourceAssignmentRepository(pool);
      await assignments.saveProvisional(
        [
          new ResourceAssignment(
            null,
            1,
            7,
            3,
            3,
            30,
            ResourceSufficiency.SUFFICIENT,
            AssignmentStatus.CONFIRMED,
            start,
            end,
            start,
            end,
            "Nota original",
            9,
            new Date(),
            9,
            new Date()
          ),
        ],
        []
      );
      adapter = new ConfirmedResourceAdapter(assignments, resources);
      derived = new PostgresDerivedInformationRepository(pool);
      proposals = new PostgresProposalRepository(pool);
      const transactions = new PostgresTransactionManager(pool);
      save = new SaveAgreementsUseCase(requests, adapter, derived, transactions);
      get = new GetRequestAgreementsUseCase(
        requests,
        clients,
        adapter,
        derived,
        null,
        transactions
      );
      pdf = {
        rendered: [],
        stored: [],
        async generate(input) {
          this.rendered.push(input);
          return { buffer: Buffer.from("%PDF-test") };
        },
        async store(name) {
          this.stored.push(name);
        },
      };
      generate = new GenerateProposalUseCase(
        requests,
        clients,
        derived,
        proposals,
        adapter,
        pdf,
        transactions
      );
    });
    afterEach(async () => {
      if (pool) await pool.end();
      if (admin) {
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
      }
    });
    function form(revision, quantity = 3, location = "Lugar A") {
      return new SaveAgreementsRequestDto({
        derived_information_id: revision,
        location,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        observations: location,
        adjusted_resources: [{ resource_id: 7, quantity }],
      });
    }
    const proposalDto = (id) => new GenerateProposalRequestDto({ derived_information_id: id });
    async function waitForLock() {
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await admin.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
          [schema]
        );
        if (result.rowCount) return;
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      }
      throw new Error("Expected an independent connection waiting on the request row lock");
    }
    it("rejects revision A after B, then generates B with its quantities after refreshing", async () => {
      const a = (await save.execute(1, 9, form(null))).data.derived_information_id;
      await save.execute(1, 9, form(a, 5, "Lugar B"));
      await expect(generate.execute(1, 9, proposalDto(a))).rejects.toMatchObject({
        code: "AGREEMENTS_REVISION_CHANGED",
      });
      expect(pdf.rendered).toHaveLength(0);
      const latest = (await get.execute(1, 9)).data;
      expect(latest.assigned_resources[0]).toMatchObject({
        quantity: 5,
        requested_quantity: 3,
        observation: "Nota original",
      });
      await generate.execute(1, 9, proposalDto(latest.derived_information_id));
      expect(pdf.rendered[0].information.location).toBe("Lugar B");
      expect(pdf.rendered[0].resources[0].quantity).toBe(5);
      expect((await pool.query("SELECT quantity FROM proposal_resources")).rows[0].quantity).toBe(
        5
      );
    });
    it("waits for a concurrent save before reading its quantities and rejects the old revision", async () => {
      const a = (await save.execute(1, 9, form(null))).data.derived_information_id;
      const reached = gate();
      const finish = gate();
      const create = derived.create.bind(derived);
      derived.create = async (...args) => {
        reached.resolve();
        await finish.promise;
        return create(...args);
      };
      const saving = save.execute(1, 9, form(a, 5, "Lugar B"));
      await reached.promise;
      const generating = generate.execute(1, 9, proposalDto(a)).catch((error) => error);
      try {
        await waitForLock();
        expect(pdf.rendered).toHaveLength(0);
      } finally {
        finish.resolve();
      }
      await saving;
      expect(await generating).toMatchObject({ code: "AGREEMENTS_REVISION_CHANGED" });
      expect(await proposals.findByRequestId(1)).toBeNull();
    });
    it("prevents an agreement save from changing resources during PDF generation", async () => {
      const a = (await save.execute(1, 9, form(null))).data.derived_information_id;
      const reached = gate();
      const finish = gate();
      const render = pdf.generate.bind(pdf);
      pdf.generate = async (input) => {
        reached.resolve();
        await finish.promise;
        return render(input);
      };
      const generating = generate.execute(1, 9, proposalDto(a));
      await reached.promise;
      const saving = save.execute(1, 9, form(a, 5, "Lugar B")).catch((error) => error);
      try {
        await waitForLock();
      } finally {
        finish.resolve();
      }
      await generating;
      expect(await saving).toMatchObject({ name: "RequestNotInAgreementsStateException" });
      expect(pdf.rendered[0].information.location).toBe("Lugar A");
      expect(pdf.rendered[0].resources[0].quantity).toBe(3);
      expect((await adapter.findActiveByRequestId(1))[0].quantity).toBe(3);
    });
  }
);
