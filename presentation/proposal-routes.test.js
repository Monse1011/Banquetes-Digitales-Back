const request = require("supertest");
const { createApp } = require("./app");
const {
  InMemoryClientRepository,
} = require("../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryReservationRequestRepository,
} = require("../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryAssignedResourceRepository,
} = require("../infrastructure/repositories/proposal/in-memory-assigned-resource-repository");
const {
  InMemoryDerivedInformationRepository,
} = require("../infrastructure/repositories/proposal/in-memory-derived-information-repository");
const {
  InMemoryProposalRepository,
} = require("../infrastructure/repositories/proposal/in-memory-proposal-repository");
const {
  InMemoryAuditLogRepository,
} = require("../infrastructure/repositories/proposal/in-memory-audit-log-repository");
const {
  GetRequestAgreementsUseCase,
} = require("../application/use-cases/proposal/get-request-agreements-use-case");
const {
  SaveAgreementsUseCase,
} = require("../application/use-cases/proposal/save-agreements-use-case");
const {
  GenerateProposalUseCase,
} = require("../application/use-cases/proposal/generate-proposal-use-case");
const { GetProposalUseCase } = require("../application/use-cases/proposal/get-proposal-use-case");
const {
  DownloadProposalUseCase,
} = require("../application/use-cases/proposal/download-proposal-use-case");
const { SendProposalUseCase } = require("../application/use-cases/proposal/send-proposal-use-case");
const { Client } = require("../domain/entities/client/client");
const { DerivedInformation } = require("../domain/entities/proposal/derived-information");
const {
  ReservationRequest,
} = require("../domain/entities/reservation-request/reservation-request");
const { ReservationRequestStatus } = require("../domain/enums/reservation-request/request-status");
const UserRole = require("../domain/enums/auth/user-role");

const LOGISTIC_USER_ID = 7;
const DAY = 24 * 60 * 60 * 1000;
const AUTH_COOKIE = "auth_token=valid-token";

function futureDate(days, hour) {
  const date = new Date(Date.now() + days * DAY);

  date.setHours(hour, 0, 0, 0);

  return date;
}

describe("Rutas de la Función 3.4", () => {
  let app;
  let reservationRequestRepository;
  let derivedInformationRepository;
  let proposalRepository;
  let auditLogRepository;
  let pdfGenerator;
  let emailService;
  let currentRole;

  beforeEach(() => {
    currentRole = UserRole.LOGISTICA;

    const clientRepository = new InMemoryClientRepository();
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    const assignedResourceRepository = new InMemoryAssignedResourceRepository([
      { id: 1, name: "Mesero", type: "HUMAN", unitCost: 300, totalQuantity: 5 },
    ]);
    derivedInformationRepository = new InMemoryDerivedInformationRepository();
    proposalRepository = new InMemoryProposalRepository(
      reservationRequestRepository,
      derivedInformationRepository
    );
    auditLogRepository = new InMemoryAuditLogRepository();
    pdfGenerator = {
      async generate({ fileName }) {
        return { fileName, buffer: Buffer.from("%PDF-1.4 test") };
      },
      async store() {},
      async read() {
        return Buffer.from("%PDF-1.4 test");
      },
    };
    emailService = { async sendProposalEmail() {} };

    clientRepository.create(
      new Client(null, "Andrea Morales", "andrea@gmail.com", "9991234567", new Date())
    );

    app = createApp({
      authController: {
        login: (_req, res) => res.status(200).json({}),
        changePassword: (_req, res) => res.status(200).json({}),
        firstAccess: (_req, res) => res.status(200).json({ firstAccess: true }),
      },
      passwordResetController: {
        requestReset: (_req, res) => res.status(200).json({}),
        resetPassword: (_req, res) => res.status(200).json({}),
      },
      tokenService: {
        verifyToken: () => ({ id_user: LOGISTIC_USER_ID, role: currentRole }),
      },
      clientRepository,
      getRequestAgreementsUseCase: new GetRequestAgreementsUseCase(
        reservationRequestRepository,
        clientRepository,
        assignedResourceRepository,
        derivedInformationRepository
      ),
      saveAgreementsUseCase: new SaveAgreementsUseCase(
        reservationRequestRepository,
        assignedResourceRepository,
        derivedInformationRepository
      ),
      generateProposalUseCase: new GenerateProposalUseCase(
        reservationRequestRepository,
        clientRepository,
        derivedInformationRepository,
        proposalRepository,
        assignedResourceRepository,
        pdfGenerator
      ),
      getProposalUseCase: new GetProposalUseCase(reservationRequestRepository, proposalRepository),
      downloadProposalUseCase: new DownloadProposalUseCase(
        reservationRequestRepository,
        proposalRepository,
        pdfGenerator
      ),
      sendProposalUseCase: new SendProposalUseCase(
        reservationRequestRepository,
        clientRepository,
        proposalRepository,
        pdfGenerator,
        emailService,
        auditLogRepository
      ),
    });
  });

  async function createRequest(status = ReservationRequestStatus.COORDINATION_READY) {
    const created = await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        "EVT-2026-0101",
        1,
        null,
        futureDate(10, 18),
        futureDate(10, 23),
        50,
        "Salón Los Pinos",
        status,
        new Date(),
        [],
        LOGISTIC_USER_ID,
        1,
        new Date()
      )
    );

    return created.requestId;
  }

  function agreementsBody(overrides = {}) {
    return {
      data: {
        location: "Salón Los Pinos Mérida",
        start_datetime: futureDate(10, 18).toISOString(),
        end_datetime: futureDate(10, 23).toISOString(),
        observations: "Montaje imperial",
        adjusted_resources: [{ resource_id: 1, quantity: 2 }],
        ...overrides,
      },
    };
  }

  it("rejects unauthenticated and non-logistics users", async () => {
    const requestId = await createRequest();

    await request(app).get(`/api/logistics/requests/${requestId}`).expect(401);

    currentRole = UserRole.ADMIN;
    await request(app)
      .get(`/api/logistics/requests/${requestId}`)
      .set("Cookie", AUTH_COOKIE)
      .expect(403);
  });

  it("preloads the agreements form with client data and assigned resources", async () => {
    const requestId = await createRequest();

    const response = await request(app)
      .get(`/api/logistics/requests/${requestId}`)
      .set("Cookie", AUTH_COOKIE)
      .expect(200);

    expect(response.body.data).toMatchObject({
      folio: "EVT-2026-0101",
      can_register_agreements: true,
      client: { client_name: "Andrea Morales", client_email: "andrea@gmail.com" },
    });
  });

  it("saves agreements and generates the proposal end to end (RF-2.3.4.5)", async () => {
    const requestId = await createRequest();

    const saved = await request(app)
      .post(`/api/logistics/requests/${requestId}/derived-information`)
      .set("Cookie", AUTH_COOKIE)
      .send(agreementsBody())
      .expect(201);

    expect(saved.body.data.derived_information_id).toBe(1);

    const generated = await request(app)
      .post(`/api/logistics/requests/${requestId}/proposals`)
      .set("Cookie", AUTH_COOKIE)
      .send({ data: { derived_information_id: saved.body.data.derived_information_id } })
      .expect(201);

    expect(generated.body.data.request_status).toBe("Propuesta generada");

    const proposal = await request(app)
      .get(`/api/logistics/requests/${requestId}/proposals`)
      .set("Cookie", AUTH_COOKIE)
      .expect(200);

    expect(proposal.body.data.pdf_url).toBe(
      `/api/logistics/requests/${requestId}/proposals/download`
    );

    const download = await request(app)
      .get(`/api/logistics/requests/${requestId}/proposals/download`)
      .set("Cookie", AUTH_COOKIE)
      .expect(200);

    expect(download.headers["content-type"]).toContain("application/pdf");

    await request(app)
      .post(`/api/logistics/requests/${requestId}/proposals/send`)
      .set("Cookie", AUTH_COOKIE)
      .expect(200);

    expect(auditLogRepository.entries[0].action).toBe("PROPOSAL_SENT");
  });

  it("rejects agreements with missing required fields (RF-2.3.4.3)", async () => {
    const requestId = await createRequest();

    const response = await request(app)
      .post(`/api/logistics/requests/${requestId}/derived-information`)
      .set("Cookie", AUTH_COOKIE)
      .send(agreementsBody({ location: "" }))
      .expect(400);

    expect(response.body.errors.location).toBe("El campo ubicación es obligatorio.");
  });

  it("rejects agreements and proposals in invalid states (RF-2.3.4.1 / RF-2.3.4.12)", async () => {
    const requestId = await createRequest(ReservationRequestStatus.PROPOSAL_GENERATED);

    await request(app)
      .post(`/api/logistics/requests/${requestId}/derived-information`)
      .set("Cookie", AUTH_COOKIE)
      .send(agreementsBody())
      .expect(409);

    const saved = await derivedInformationRepository.create(
      new DerivedInformation(
        null,
        requestId,
        "Salón",
        futureDate(10, 18),
        futureDate(10, 23),
        null,
        LOGISTIC_USER_ID,
        new Date()
      )
    );

    const response = await request(app)
      .post(`/api/logistics/requests/${requestId}/proposals`)
      .set("Cookie", AUTH_COOKIE)
      .send({ data: { derived_information_id: saved.id } })
      .expect(409);

    expect(response.body.message).toBe("La propuesta ya fue generada y no puede regenerarse.");
  });

  it("returns 404 for requests of another responsible (RF-2.3.4.12)", async () => {
    const created = await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        "EVT-2026-0102",
        1,
        null,
        futureDate(10, 18),
        futureDate(10, 23),
        50,
        "Salón",
        ReservationRequestStatus.COORDINATION_READY,
        new Date(),
        [],
        8,
        1,
        new Date()
      )
    );

    await request(app)
      .get(`/api/logistics/requests/${created.requestId}`)
      .set("Cookie", AUTH_COOKIE)
      .expect(404);
  });
});
