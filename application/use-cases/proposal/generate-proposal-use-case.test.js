const { GenerateProposalUseCase } = require("./generate-proposal-use-case");
const { GenerateProposalRequestDto } = require("../../dto/proposal/generate-proposal-request-dto");
const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryClientRepository,
} = require("../../../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryAssignedResourceRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-assigned-resource-repository");
const {
  InMemoryDerivedInformationRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-derived-information-repository");
const {
  InMemoryProposalRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-proposal-repository");
const { Client } = require("../../../domain/entities/client/client");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const { DerivedInformation } = require("../../../domain/entities/proposal/derived-information");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const ProposalAlreadyGeneratedException = require("../../../domain/exceptions/proposal/proposal-already-generated-exception");
const ProposalGenerationNotAllowedException = require("../../../domain/exceptions/proposal/proposal-generation-not-allowed-exception");
const ProposalGenerationFailedException = require("../../../domain/exceptions/proposal/proposal-generation-failed-exception");
const DerivedInformationNotFoundException = require("../../../domain/exceptions/proposal/derived-information-not-found-exception");

const LOGISTIC_USER_ID = 7;
const DAY = 24 * 60 * 60 * 1000;

function futureDate(days, hour) {
  const date = new Date(Date.now() + days * DAY);

  date.setHours(hour, 0, 0, 0);

  return date;
}

describe("GenerateProposalUseCase", () => {
  let reservationRequestRepository;
  let clientRepository;
  let derivedInformationRepository;
  let proposalRepository;
  let assignedResourceRepository;
  let pdfGenerator;
  let useCase;

  beforeEach(() => {
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    clientRepository = new InMemoryClientRepository();
    derivedInformationRepository = new InMemoryDerivedInformationRepository();
    proposalRepository = new InMemoryProposalRepository(
      reservationRequestRepository,
      derivedInformationRepository
    );
    assignedResourceRepository = new InMemoryAssignedResourceRepository([
      { id: 1, name: "Mesero", type: "HUMAN", unitCost: 300, totalQuantity: 5 },
    ]);
    pdfGenerator = {
      stored: [],
      async generate() {
        return { fileName: "propuesta.pdf", buffer: Buffer.from("%PDF-1.4 test") };
      },
      async store(fileName) {
        this.stored.push(fileName);
      },
      async read() {
        return Buffer.from("%PDF-1.4 test");
      },
    };
    useCase = new GenerateProposalUseCase(
      reservationRequestRepository,
      clientRepository,
      derivedInformationRepository,
      proposalRepository,
      assignedResourceRepository,
      pdfGenerator
    );
  });

  async function setup(status = ReservationRequestStatus.COORDINATION_READY) {
    const client = await clientRepository.create(
      new Client(null, "Andrea Morales", "andrea@gmail.com", "9991234567", new Date())
    );
    const request = await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        "EVT-2026-0101",
        client.clientId,
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
    const information = await derivedInformationRepository.create(
      new DerivedInformation(
        null,
        request.requestId,
        "Salón Los Pinos Mérida",
        futureDate(10, 18),
        futureDate(10, 23),
        "Montaje imperial",
        LOGISTIC_USER_ID,
        new Date()
      )
    );

    return { client, request, information };
  }

  it("generates the PDF and changes the status in a single operation (RF-2.3.4.5)", async () => {
    const { request, information } = await setup();

    const result = await useCase.execute(
      request.requestId,
      LOGISTIC_USER_ID,
      new GenerateProposalRequestDto({
        derived_information_id: information.id,
        client_observations: "Incluye promoción de barra libre.",
      })
    );

    expect(result.data.proposals_code).toMatch(/^PROP-\d{4}-0001$/);
    expect(result.data.request_status).toBe(ReservationRequestStatus.PROPOSAL_GENERATED);
    expect(result.data.status).toBe(ProposalStatus.IN_REVIEW);
    expect(result.data.name).toMatch(/^Propuesta_AndreaMorales_\d{8}_EVT-2026-0101\.pdf$/);
    expect(pdfGenerator.stored).toHaveLength(1);
    expect((await reservationRequestRepository.findById(request.requestId)).status).toBe(
      ReservationRequestStatus.PROPOSAL_GENERATED
    );
  });

  it("builds the file name without accents or spaces and with AAAAMMDD (RF-2.3.4.4)", async () => {
    const { request, information } = await setup();

    const result = await useCase.execute(
      request.requestId,
      LOGISTIC_USER_ID,
      new GenerateProposalRequestDto({ derived_information_id: information.id })
    );
    const [prefix, clientName, date, folio] = result.data.name.replace(".pdf", "").split("_");

    expect(prefix).toBe("Propuesta");
    expect(clientName).toBe("AndreaMorales");
    expect(date).toMatch(/^\d{8}$/);
    expect(folio).toBe("EVT-2026-0101");
  });

  it("rejects regeneration once the proposal exists (RF-2.3.4.12)", async () => {
    const { request, information } = await setup(ReservationRequestStatus.PROPOSAL_GENERATED);

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        new GenerateProposalRequestDto({ derived_information_id: information.id })
      )
    ).rejects.toBeInstanceOf(ProposalAlreadyGeneratedException);
  });

  it("rejects generation outside coordination states", async () => {
    const { request, information } = await setup(ReservationRequestStatus.ASSIGNED);

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        new GenerateProposalRequestDto({ derived_information_id: information.id })
      )
    ).rejects.toBeInstanceOf(ProposalGenerationNotAllowedException);
  });

  it("rejects agreements of another request", async () => {
    const { request } = await setup();

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        new GenerateProposalRequestDto({ derived_information_id: 999 })
      )
    ).rejects.toBeInstanceOf(DerivedInformationNotFoundException);
  });

  it("keeps the status when the PDF generation fails (RF-2.3.4.5)", async () => {
    const { request, information } = await setup();
    pdfGenerator.generate = async () => {
      throw new Error("pdfkit crashed");
    };

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        new GenerateProposalRequestDto({ derived_information_id: information.id })
      )
    ).rejects.toBeInstanceOf(ProposalGenerationFailedException);

    expect((await reservationRequestRepository.findById(request.requestId)).status).toBe(
      ReservationRequestStatus.COORDINATION_READY
    );
    expect(proposalRepository.proposals).toHaveLength(0);
  });
});
