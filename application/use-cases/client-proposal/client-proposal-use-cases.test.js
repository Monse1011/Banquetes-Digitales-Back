const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryClientRepository,
} = require("../../../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryDerivedInformationRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-derived-information-repository");
const {
  InMemoryProposalRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-proposal-repository");
const {
  InMemoryAssignedResourceRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-assigned-resource-repository");
const {
  InMemoryProposalAdjustmentRepository,
} = require("../../../infrastructure/repositories/client-proposal/in-memory-proposal-adjustment-repository");
const {
  InMemoryAcceptanceScheduler,
} = require("../../../infrastructure/services/proposal/in-memory-acceptance-scheduler");
const { Client } = require("../../../domain/entities/client/client");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const { DerivedInformation } = require("../../../domain/entities/proposal/derived-information");
const { Proposal } = require("../../../domain/entities/proposal/proposal");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { ProposalAccess } = require("../../../domain/enums/client-proposal/proposal-access");
const { ProposalAction } = require("../../../domain/enums/client-proposal/proposal-action");
const { ClientProposalMessages } = require("../../../domain/constants/client-proposal-messages");
const InvalidFolioFormatException = require("../../../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ClientRequestNotFoundException = require("../../../domain/exceptions/client-proposal/client-request-not-found-exception");
const ClientProposalNotAvailableException = require("../../../domain/exceptions/client-proposal/client-proposal-not-available-exception");
const ProposalAcceptanceConflictException = require("../../../domain/exceptions/client-proposal/proposal-acceptance-conflict-exception");
const ProposalAcceptanceFailedException = require("../../../domain/exceptions/client-proposal/proposal-acceptance-failed-exception");

const { GetClientRequestTrackingUseCase } = require("./get-client-request-tracking-use-case");
const { GetClientProposalDetailUseCase } = require("./get-client-proposal-detail-use-case");
const { AcceptProposalUseCase } = require("./accept-proposal-use-case");
const { RequestProposalAdjustmentsUseCase } = require("./request-proposal-adjustments-use-case");
const { RejectProposalUseCase } = require("./reject-proposal-use-case");
const { GetClientProposalPdfUseCase } = require("./get-client-proposal-pdf-use-case");

const DAY = 24 * 60 * 60 * 1000;
const FOLIO = "BD-2026-00123";

function futureDate(days, hour) {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function buildHarness({
  status = ReservationRequestStatus.PROPOSAL_GENERATED,
  conflicts = null,
} = {}) {
  const reservationRequestRepository = new InMemoryReservationRequestRepository();
  const clientRepository = new InMemoryClientRepository();
  const derivedInformationRepository = new InMemoryDerivedInformationRepository();
  const proposalRepository = new InMemoryProposalRepository(
    reservationRequestRepository,
    derivedInformationRepository
  );
  const assignedResourceRepository = new InMemoryAssignedResourceRepository([
    { id: 1, name: "Ana López", type: ResourceType.HUMAN, unitCost: 800 },
    { id: 2, name: "Luis Pérez", type: ResourceType.HUMAN, unitCost: 800 },
    { id: 3, name: "Vajilla completa", type: ResourceType.MATERIAL, unitCost: 25 },
  ]);
  const proposalAdjustmentRepository = new InMemoryProposalAdjustmentRepository(proposalRepository);
  const acceptanceScheduler = new InMemoryAcceptanceScheduler({ conflicts });
  const stored = [];
  const pdfGenerator = {
    stored,
    async generateAccepted({ fileName }) {
      return { fileName, buffer: Buffer.from("%PDF-1.4 aceptada") };
    },
    async store(fileName, buffer) {
      stored.push({ fileName, buffer });
    },
    async read(fileName) {
      if (fileName.startsWith("MISSING")) {
        throw new Error("ENOENT");
      }
      return Buffer.from(`%PDF-1.4 ${fileName}`);
    },
  };

  async function seed() {
    const client = await clientRepository.create(
      new Client(null, "Andrea Morales", "andrea@gmail.com", "9991234567", new Date())
    );
    const request = await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        FOLIO,
        client.clientId,
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
        request.requestId,
        "Salón Los Pinos Mérida",
        futureDate(10, 18),
        futureDate(10, 23),
        null,
        7,
        new Date(),
        150
      )
    );
    const proposal = await proposalRepository.createWithRequestStatus(
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
      request.requestId,
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
          description: "Vajilla completa",
          quantity: 150,
          unitCost: 25,
        },
      ]
    );

    // createWithRequestStatus fija "Propuesta generada"; se restaura el estado deseado
    // para simular solicitudes ya avanzadas en el ciclo de confirmación.
    request.status = status;
    request.statusChangedAt = new Date();

    return { client, request, information, proposal };
  }

  return {
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    assignedResourceRepository,
    proposalAdjustmentRepository,
    acceptanceScheduler,
    pdfGenerator,
    seed,
  };
}

describe("Función 4.5 - Seguimiento de solicitud por folio", () => {
  it("rechaza un folio con formato inválido (RF-3.4.5.1.1)", async () => {
    const { reservationRequestRepository, clientRepository, derivedInformationRepository } =
      buildHarness();
    const useCase = new GetClientRequestTrackingUseCase(
      reservationRequestRepository,
      clientRepository,
      derivedInformationRepository
    );

    await expect(useCase.execute("NOPE")).rejects.toBeInstanceOf(InvalidFolioFormatException);
  });

  it("responde 404 con el mensaje del folio cuando no existe (RF-3.4.5.1.2)", async () => {
    const { reservationRequestRepository, clientRepository, derivedInformationRepository } =
      buildHarness();
    const useCase = new GetClientRequestTrackingUseCase(
      reservationRequestRepository,
      clientRepository,
      derivedInformationRepository
    );

    await expect(useCase.execute("BD-2026-99999")).rejects.toBeInstanceOf(
      ClientRequestNotFoundException
    );
  });

  it("devuelve datos generales y proposal_access INTERACTIVE sin información interna (RF-3.4.5.2/6/11)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    const { request } = await harness.seed();
    const useCase = new GetClientRequestTrackingUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository
    );

    const result = await useCase.execute(FOLIO);

    expect(result.data).toMatchObject({
      folio: FOLIO,
      client_name: "Andrea Morales",
      guest_count: 150,
      status: "IN_REVIEW",
      proposal_access: ProposalAccess.INTERACTIVE,
    });
    expect(result.data).not.toHaveProperty("logistic_user");
    expect(result.data).not.toHaveProperty("observations");
    expect(request.status).toBe(ReservationRequestStatus.IN_REVIEW);
  });

  it("expone PDF_ONLY en confirmado (RF-3.4.5.8)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.CONFIRMED });
    await harness.seed();
    const useCase = new GetClientRequestTrackingUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository
    );

    const result = await useCase.execute(FOLIO);

    expect(result.data.proposal_access).toBe(ProposalAccess.PDF_ONLY);
  });

  it("expone NONE en ajustes solicitados y rechazada (RF-3.4.5.13/14)", async () => {
    for (const status of [
      ReservationRequestStatus.ADJUSTMENTS_REQUESTED,
      ReservationRequestStatus.REJECTED,
    ]) {
      const harness = buildHarness({ status });
      await harness.seed();
      const useCase = new GetClientRequestTrackingUseCase(
        harness.reservationRequestRepository,
        harness.clientRepository,
        harness.derivedInformationRepository
      );

      const result = await useCase.execute(FOLIO);
      expect(result.data.proposal_access).toBe(ProposalAccess.NONE);
    }
  });
});

describe("Función 4.4 - Detalle de la propuesta vigente", () => {
  it("en la primera visualización pasa a En revisión y guarda viewed_at e historial (RF-3.4.4.2)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.PROPOSAL_GENERATED });
    const { request, proposal } = await harness.seed();
    const useCase = new GetClientProposalDetailUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository
    );

    const result = await useCase.execute(FOLIO);

    expect(harness.reservationRequestRepository.findById(request.requestId)).toBeTruthy();
    expect(request.status).toBe(ReservationRequestStatus.IN_REVIEW);
    expect(proposal.viewedAt).toBeInstanceOf(Date);
    expect(harness.reservationRequestRepository.history).toHaveLength(1);
    expect(result.data.request_status).toBe("IN_REVIEW");
    expect(result.data.available_actions).toEqual([
      ProposalAction.ACCEPT,
      ProposalAction.REQUEST_ADJUSTMENTS,
      ProposalAction.REJECT,
    ]);
  });

  it("es idempotente: una segunda visualización no re-registra el historial (RF-3.4.4.2)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.PROPOSAL_GENERATED });
    await harness.seed();
    const useCase = new GetClientProposalDetailUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository
    );

    await useCase.execute(FOLIO);
    await useCase.execute(FOLIO);

    expect(harness.reservationRequestRepository.history).toHaveLength(1);
  });

  it("agrupa humanos por rol y costo, y lee importes congelados sin recalcular (RF-3.4.4.3)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    await harness.seed();
    const useCase = new GetClientProposalDetailUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository
    );

    const result = await useCase.execute(FOLIO);
    const { data } = result;

    expect(data.proposal.resources.human).toEqual([
      { description: "Chef", quantity: 2, unit_cost: 800, subtotal: 1600 },
    ]);
    expect(data.proposal.resources.material).toEqual([
      { description: "Vajilla completa", quantity: 150, unit_cost: 25, subtotal: 3750 },
    ]);
    expect(data.proposal.subtotal).toBe(8600);
    expect(data.proposal.total_amount).toBe(8000);
    expect(data.proposal.currency).toBe("MXN");
  });

  it("responde 404 con el mensaje del folio en estados sin acceso (CONFIRMED)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.CONFIRMED });
    await harness.seed();
    const useCase = new GetClientProposalDetailUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository
    );

    await expect(useCase.execute(FOLIO)).rejects.toBeInstanceOf(ClientRequestNotFoundException);
  });
});

describe("Función 4.4 - Aceptar propuesta", () => {
  it("confirma la solicitud, acepta la propuesta y guarda el PDF inalterable (RF-3.4.4.4.2/3/6)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    const { request, proposal } = await harness.seed();
    const useCase = new AcceptProposalUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository,
      harness.pdfGenerator,
      harness.acceptanceScheduler
    );

    const result = await useCase.execute(FOLIO);

    expect(request.status).toBe(ReservationRequestStatus.CONFIRMED);
    expect(proposal.status).toBe(ProposalStatus.ACCEPTED);
    expect(proposal.acceptedPdfPath).toContain("PropuestaAceptada_");
    expect(harness.acceptanceScheduler.scheduled).toEqual([request.requestId]);
    expect(result.data).toMatchObject({
      current_status: "CONFIRMED",
      proposal_status: "ACCEPTED",
    });
  });

  it("rechaza con 409 si la solicitud no está en revisión", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.PROPOSAL_GENERATED });
    await harness.seed();
    const useCase = new AcceptProposalUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository,
      harness.pdfGenerator,
      harness.acceptanceScheduler
    );

    await expect(useCase.execute(FOLIO)).rejects.toBeInstanceOf(
      ClientProposalNotAvailableException
    );
  });

  it("revierte y responde 409 cuando hay conflicto de disponibilidad (RF-2.3.3.1)", async () => {
    const harness = buildHarness({
      status: ReservationRequestStatus.IN_REVIEW,
      conflicts: [{ type: "responsible", reason: "overlap" }],
    });
    const { request } = await harness.seed();
    const useCase = new AcceptProposalUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository,
      harness.pdfGenerator,
      harness.acceptanceScheduler
    );

    await expect(useCase.execute(FOLIO)).rejects.toBeInstanceOf(
      ProposalAcceptanceConflictException
    );
    expect(request.status).toBe(ReservationRequestStatus.IN_REVIEW);
  });

  it("responde 500 con el mensaje de aceptación fallida si el PDF falla", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    await harness.seed();
    harness.pdfGenerator.generateAccepted = async () => {
      throw new Error("pdf boom");
    };
    const useCase = new AcceptProposalUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository,
      harness.pdfGenerator,
      harness.acceptanceScheduler
    );

    await expect(useCase.execute(FOLIO)).rejects.toBeInstanceOf(ProposalAcceptanceFailedException);
  });
});

describe("Función 4.4 - Solicitar ajustes", () => {
  it("cambia a Ajustes Solicitados y almacena la observación con fecha (RF-3.4.4.5.2/6)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    const { request, proposal } = await harness.seed();
    const useCase = new RequestProposalAdjustmentsUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.proposalAdjustmentRepository
    );

    const result = await useCase.execute(FOLIO, "Cambiar hora a 19:00");

    expect(request.status).toBe(ReservationRequestStatus.ADJUSTMENTS_REQUESTED);
    expect(proposal.status).toBe(ProposalStatus.ADJUSTMENTS_REQUESTED);
    expect(result.data).toMatchObject({
      current_status: "ADJUSTMENTS_REQUESTED",
    });
    const stored = await harness.proposalAdjustmentRepository.findByRequestId(request.requestId);
    expect(stored).toHaveLength(1);
    expect(stored[0].observations).toBe("Cambiar hora a 19:00");
  });

  it("rechaza con 409 si no está en revisión", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.PROPOSAL_GENERATED });
    await harness.seed();
    const useCase = new RequestProposalAdjustmentsUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.proposalAdjustmentRepository
    );

    await expect(useCase.execute(FOLIO, "x")).rejects.toBeInstanceOf(
      ClientProposalNotAvailableException
    );
  });
});

describe("Función 4.4 - Rechazar propuesta", () => {
  it("rechaza la solicitud y propuesta y libera asignaciones (RF-3.4.4.6.4)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    const { request, proposal } = await harness.seed();
    const releaseCalls = [];
    harness.assignedResourceRepository.releaseByRequestId = async (requestId, transaction) => {
      releaseCalls.push({ requestId, transaction });
    };
    const useCase = new RejectProposalUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.assignedResourceRepository
    );

    const result = await useCase.execute(FOLIO);

    expect(request.status).toBe(ReservationRequestStatus.REJECTED);
    expect(proposal.status).toBe(ProposalStatus.REJECTED);
    expect(releaseCalls).toEqual([{ requestId: request.requestId, transaction: null }]);
    expect(result.data).toMatchObject({
      current_status: "REJECTED",
      previous_status: "IN_REVIEW",
    });
  });

  it("tras rechazar, el detalle ya no ofrece acciones (RF-3.4.4.6.5)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.REJECTED });
    await harness.seed();
    const useCase = new GetClientProposalDetailUseCase(
      harness.reservationRequestRepository,
      harness.clientRepository,
      harness.derivedInformationRepository,
      harness.proposalRepository
    );

    await expect(useCase.execute(FOLIO)).rejects.toBeInstanceOf(ClientRequestNotFoundException);
  });
});

describe("Función 4.4/4.5 - Ver o descargar PDF", () => {
  it("entrega el PDF de aceptación cuando la propuesta está aceptada (RF-3.4.4.4.3)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.CONFIRMED });
    const { proposal } = await harness.seed();
    proposal.status = ProposalStatus.ACCEPTED;
    proposal.acceptedPdfPath = "PropuestaAceptada_AndreaMorales_20261224_BD-2026-00123.pdf";
    const useCase = new GetClientProposalPdfUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.pdfGenerator
    );

    const result = await useCase.execute(FOLIO, { download: true });

    expect(result.fileName).toBe(proposal.acceptedPdfPath);
    expect(result.disposition).toBe("attachment");
  });

  it("usa inline sin download=true", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    await harness.seed();
    const useCase = new GetClientProposalPdfUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.pdfGenerator
    );

    const result = await useCase.execute(FOLIO);

    expect(result.disposition).toBe("inline");
  });

  it("responde 404 con el mensaje del folio cuando no hay acceso (NONE)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.PENDING });
    await harness.seed();
    const useCase = new GetClientProposalPdfUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.pdfGenerator
    );

    await expect(useCase.execute(FOLIO)).rejects.toBeInstanceOf(ClientRequestNotFoundException);
  });

  it("no cambia el estado ni registra visualización (RF-3.4.4.2)", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    const { request } = await harness.seed();
    const useCase = new GetClientProposalPdfUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.pdfGenerator
    );

    await useCase.execute(FOLIO);

    expect(request.status).toBe(ReservationRequestStatus.IN_REVIEW);
    expect(harness.reservationRequestRepository.history || []).toHaveLength(0);
  });

  it("falla si el archivo no existe", async () => {
    const harness = buildHarness({ status: ReservationRequestStatus.IN_REVIEW });
    const { proposal } = await harness.seed();
    proposal.name = "MISSING_file.pdf";
    const useCase = new GetClientProposalPdfUseCase(
      harness.reservationRequestRepository,
      harness.proposalRepository,
      harness.pdfGenerator
    );

    await expect(useCase.execute(FOLIO)).rejects.toThrow(
      expect.objectContaining({ message: expect.any(String) })
    );
    expect(ClientProposalMessages.PROPOSAL_FILE_MISSING).toBeUndefined();
  });
});
