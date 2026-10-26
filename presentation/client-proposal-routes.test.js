const request = require("supertest");
const { createApp } = require("./app");
const {
  InMemoryReservationRequestRepository,
} = require("../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryClientRepository,
} = require("../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryDerivedInformationRepository,
} = require("../infrastructure/repositories/proposal/in-memory-derived-information-repository");
const {
  InMemoryProposalRepository,
} = require("../infrastructure/repositories/proposal/in-memory-proposal-repository");
const {
  InMemoryAssignedResourceRepository,
} = require("../infrastructure/repositories/proposal/in-memory-assigned-resource-repository");
const {
  InMemoryProposalAdjustmentRepository,
} = require("../infrastructure/repositories/client-proposal/in-memory-proposal-adjustment-repository");
const {
  InMemoryAcceptanceScheduler,
} = require("../infrastructure/services/proposal/in-memory-acceptance-scheduler");
const {
  GetClientRequestTrackingUseCase,
} = require("../application/use-cases/client-proposal/get-client-request-tracking-use-case");
const {
  GetClientProposalDetailUseCase,
} = require("../application/use-cases/client-proposal/get-client-proposal-detail-use-case");
const {
  AcceptProposalUseCase,
} = require("../application/use-cases/client-proposal/accept-proposal-use-case");
const {
  RequestProposalAdjustmentsUseCase,
} = require("../application/use-cases/client-proposal/request-proposal-adjustments-use-case");
const {
  RejectProposalUseCase,
} = require("../application/use-cases/client-proposal/reject-proposal-use-case");
const {
  GetClientProposalPdfUseCase,
} = require("../application/use-cases/client-proposal/get-client-proposal-pdf-use-case");
const { Client } = require("../domain/entities/client/client");
const {
  ReservationRequest,
} = require("../domain/entities/reservation-request/reservation-request");
const { DerivedInformation } = require("../domain/entities/proposal/derived-information");
const { Proposal } = require("../domain/entities/proposal/proposal");
const { ReservationRequestStatus } = require("../domain/enums/reservation-request/request-status");
const { ProposalStatus } = require("../domain/enums/proposal/proposal-status");
const { ResourceType } = require("../domain/enums/resource/resource-type");
const { ClientProposalMessages } = require("../domain/constants/client-proposal-messages");

const DAY = 24 * 60 * 60 * 1000;
const FOLIO = "BD-2026-00123";

function futureDate(days, hour) {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

describe("Rutas públicas de cliente - Funciones 4.4 y 4.5", () => {
  let app;
  let reservationRequestRepository;
  let proposalRepository;
  let status;

  beforeEach(async () => {
    status = ReservationRequestStatus.PROPOSAL_GENERATED;
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    const clientRepository = new InMemoryClientRepository();
    const derivedInformationRepository = new InMemoryDerivedInformationRepository();
    proposalRepository = new InMemoryProposalRepository(
      reservationRequestRepository,
      derivedInformationRepository
    );
    const assignedResourceRepository = new InMemoryAssignedResourceRepository([]);
    const proposalAdjustmentRepository = new InMemoryProposalAdjustmentRepository(
      proposalRepository
    );
    const acceptanceScheduler = new InMemoryAcceptanceScheduler();
    const pdfGenerator = {
      async generateAccepted({ fileName }) {
        return { fileName, buffer: Buffer.from("%PDF-1.4 ok") };
      },
      async store() {},
      async read(fileName) {
        return Buffer.from(`%PDF-1.4 ${fileName}`);
      },
    };

    await clientRepository.create(
      new Client(null, "Andrea Morales", "andrea@gmail.com", "9991234567", new Date())
    );
    const request0 = await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        FOLIO,
        1,
        null,
        futureDate(10, 18),
        futureDate(10, 23),
        150,
        "Salón Los Pinos",
        status,
        new Date(),
        [],
        7,
        1,
        new Date()
      )
    );
    const information = await derivedInformationRepository.create(
      new DerivedInformation(
        null,
        request0.requestId,
        "Salón Los Pinos Mérida",
        futureDate(10, 18),
        futureDate(10, 23),
        null,
        7,
        new Date(),
        150
      )
    );
    await proposalRepository.createWithRequestStatus(
      new Proposal(
        null,
        information.id,
        "PROP-2026-0101",
        "PROP-2026-0101_Propuesta_AndreaMorales_20261224_BD-2026-00123.pdf",
        new Date(),
        ProposalStatus.IN_REVIEW,
        null,
        7,
        new Date(),
        { subtotal: 8600, discountAmount: 600, totalAmount: 8000, currency: "MXN" }
      ),
      request0.requestId,
      [status],
      [
        {
          resourceId: 1,
          type: ResourceType.HUMAN,
          description: "Chef",
          quantity: 2,
          unitCost: 800,
        },
        {
          resourceId: 3,
          type: ResourceType.MATERIAL,
          description: "Vajilla",
          quantity: 150,
          unitCost: 25,
        },
      ]
    );
    request0.status = status;

    app = createApp({
      authController: {
        session: (_req, res) => res.sendStatus(501),
        logout: (_req, res) => res.sendStatus(501),
        login: (_req, res) => res.status(200).json({}),
        changePassword: (_req, res) => res.status(200).json({}),
        firstAccess: (_req, res) => res.status(200).json({ firstAccess: true }),
      },
      passwordResetController: {
        requestReset: (_req, res) => res.status(200).json({}),
        resetPassword: (_req, res) => res.status(200).json({}),
      },
      tokenService: { verifyToken: () => ({ id_user: 7, role: "LOGISTICS" }) },
      clientRepository,
      reservationRequestRepository,
      serviceRepository: { findByIds: async () => [] },
      getClientRequestTrackingUseCase: new GetClientRequestTrackingUseCase(
        reservationRequestRepository,
        clientRepository,
        derivedInformationRepository
      ),
      getClientProposalDetailUseCase: new GetClientProposalDetailUseCase(
        reservationRequestRepository,
        clientRepository,
        derivedInformationRepository,
        proposalRepository
      ),
      acceptProposalUseCase: new AcceptProposalUseCase(
        reservationRequestRepository,
        clientRepository,
        derivedInformationRepository,
        proposalRepository,
        pdfGenerator,
        acceptanceScheduler
      ),
      requestProposalAdjustmentsUseCase: new RequestProposalAdjustmentsUseCase(
        reservationRequestRepository,
        proposalRepository,
        proposalAdjustmentRepository
      ),
      rejectProposalUseCase: new RejectProposalUseCase(
        reservationRequestRepository,
        proposalRepository,
        assignedResourceRepository
      ),
      getClientProposalPdfUseCase: new GetClientProposalPdfUseCase(
        reservationRequestRepository,
        proposalRepository,
        pdfGenerator
      ),
    });
  });

  it("GET seguimiento responde 200 con la forma del contrato", async () => {
    const response = await request(app).get(`/api/client/requests/${FOLIO}`).expect(200);

    expect(response.body.data).toMatchObject({
      folio: FOLIO,
      client_name: "Andrea Morales",
      status: "PROPOSAL_GENERATED",
      proposal_access: "INTERACTIVE",
    });
  });

  it("GET seguimiento responde 400 con el mensaje del folio por formato inválido", async () => {
    const response = await request(app).get("/api/client/requests/NOPE").expect(400);

    expect(response.body.message).toBe(ClientProposalMessages.FOLIO_NOT_FOUND);
  });

  it("GET seguimiento responde 404 con el mensaje del folio inexistente", async () => {
    const response = await request(app).get("/api/client/requests/BD-2026-99999").expect(404);

    expect(response.body.message).toBe(ClientProposalMessages.FOLIO_NOT_FOUND);
  });

  it("GET detalle transiciona a IN_REVIEW y expone las tres acciones", async () => {
    const response = await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    expect(response.body.data.request_status).toBe("IN_REVIEW");
    expect(response.body.data.available_actions).toEqual([
      "ACCEPT",
      "REQUEST_ADJUSTMENTS",
      "REJECT",
    ]);
  });

  it("POST accept exige accepted_terms=true (400)", async () => {
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    const response = await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/accept`)
      .send({ data: { accepted_terms: false } })
      .expect(400);

    expect(response.body.message).toBe(ClientProposalMessages.ACCEPT_TERMS_REQUIRED);
  });

  it("POST accept confirma la solicitud", async () => {
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    const response = await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/accept`)
      .send({ data: { accepted_terms: true } })
      .expect(200);

    expect(response.body.data).toMatchObject({
      current_status: "CONFIRMED",
      proposal_status: "ACCEPTED",
    });
  });

  it("POST adjustments valida observaciones (400 vacío, 400 >500)", async () => {
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/adjustments`)
      .send({ data: { observations: "   " } })
      .expect(400);

    await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/adjustments`)
      .send({ data: { observations: "x".repeat(501) } })
      .expect(400);
  });

  it("POST adjustments registra el cambio de estado", async () => {
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    const response = await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/adjustments`)
      .send({ data: { observations: "Cambiar hora a 19:00" } })
      .expect(200);

    expect(response.body.data.current_status).toBe("ADJUSTMENTS_REQUESTED");
  });

  it("POST reject exige confirm_rejection=true (400)", async () => {
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/reject`)
      .send({ data: { confirm_rejection: false } })
      .expect(400);
  });

  it("GET pdf responde application/pdf con Content-Disposition", async () => {
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);

    const response = await request(app)
      .get(`/api/client/requests/${FOLIO}/proposal/pdf`)
      .expect(200)
      .expect("Content-Type", /application\/pdf/);

    expect(response.headers["content-disposition"]).toMatch(/inline/);
  });

  it("flujo completo: detalle → ajustes → (regeneración v2) → detalle → aceptar", async () => {
    // El cliente abre la propuesta (pasa a IN_REVIEW).
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);
    // Solicita ajustes (pasa a ADJUSTMENTS_REQUESTED).
    await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/adjustments`)
      .send({ data: { observations: "Menos invitados" } })
      .expect(200);
    // Logística registra acuerdos y genera la versión 2; la solicitud vuelve a PROPOSAL_GENERATED.
    const request0 = await reservationRequestRepository.findByFolio(FOLIO);
    const di = new DerivedInformation(
      null,
      request0.requestId,
      "Salón Los Pinos Mérida",
      futureDate(10, 19),
      futureDate(10, 23),
      null,
      7,
      new Date(),
      130
    );
    const created = await proposalRepository.createWithRequestStatus(
      new Proposal(
        null,
        di.id,
        "PROP-2026-0102",
        "PROP-2026-0102_Propuesta_AndreaMorales_20261224_BD-2026-00123.pdf",
        new Date(),
        ProposalStatus.IN_REVIEW,
        null,
        7,
        new Date(),
        { subtotal: 8000, discountAmount: 0, totalAmount: 8000, currency: "MXN" }
      ),
      request0.requestId,
      [ReservationRequestStatus.ADJUSTMENTS_REQUESTED],
      []
    );
    expect(created.version).toBe(2);
    // El cliente vuelve a abrir (IN_REVIEW otra vez) y acepta la v2.
    await request(app).get(`/api/client/requests/${FOLIO}/proposal`).expect(200);
    await request(app)
      .post(`/api/client/requests/${FOLIO}/proposal/accept`)
      .send({ data: { accepted_terms: true } })
      .expect(200);

    const tracking = await request(app).get(`/api/client/requests/${FOLIO}`).expect(200);
    expect(tracking.body.data.status).toBe("CONFIRMED");
    expect(tracking.body.data.proposal_access).toBe("PDF_ONLY");
  });
});
