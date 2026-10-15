const { GetProposalUseCase } = require("./get-proposal-use-case");
const { DownloadProposalUseCase } = require("./download-proposal-use-case");
const { SendProposalUseCase } = require("./send-proposal-use-case");
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
  InMemoryAuditLogRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-audit-log-repository");
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
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const ProposalGenerationFailedException = require("../../../domain/exceptions/proposal/proposal-generation-failed-exception");

const LOGISTIC_USER_ID = 7;
const DAY = 24 * 60 * 60 * 1000;
const FILE_NAME = "Propuesta_AndreaMorales_20261224_EVT-2026-0101.pdf";

function futureDate(days, hour) {
  const date = new Date(Date.now() + days * DAY);

  date.setHours(hour, 0, 0, 0);

  return date;
}

describe("Gestión de propuesta generada", () => {
  let reservationRequestRepository;
  let clientRepository;
  let derivedInformationRepository;
  let proposalRepository;
  let auditLogRepository;
  let pdfGenerator;
  let emailService;

  beforeEach(() => {
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    clientRepository = new InMemoryClientRepository();
    derivedInformationRepository = new InMemoryDerivedInformationRepository();
    proposalRepository = new InMemoryProposalRepository(
      reservationRequestRepository,
      derivedInformationRepository
    );
    auditLogRepository = new InMemoryAuditLogRepository();
    pdfGenerator = {
      async read() {
        return Buffer.from("%PDF-1.4 test");
      },
    };
    emailService = {
      sent: [],
      async sendProposalEmail(email, clientName, proposalCode, fileName, buffer) {
        this.sent.push({ email, clientName, proposalCode, fileName, buffer });
      },
    };
  });

  async function setup(status = ReservationRequestStatus.PROPOSAL_GENERATED) {
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
        null,
        LOGISTIC_USER_ID,
        new Date()
      )
    );
    const proposal = new Proposal(
      1,
      information.id,
      "PROP-2026-0001",
      FILE_NAME,
      new Date(),
      ProposalStatus.IN_REVIEW,
      null,
      LOGISTIC_USER_ID,
      new Date()
    );

    proposalRepository.proposals.push(proposal);

    return { client, request, proposal };
  }

  describe("GetProposalUseCase", () => {
    it("returns the proposal with its pdf_url (RF-2.3.4.6)", async () => {
      const { request } = await setup();
      const useCase = new GetProposalUseCase(reservationRequestRepository, proposalRepository);

      const result = await useCase.execute(request.requestId, LOGISTIC_USER_ID);

      expect(result.data).toMatchObject({
        proposals_code: "PROP-2026-0001",
        name: FILE_NAME,
        status: ProposalStatus.IN_REVIEW,
        pdf_url: `/api/logistics/requests/${request.requestId}/proposals/download`,
      });
    });

    it("rejects statuses where the proposal is not visible", async () => {
      const { request } = await setup(ReservationRequestStatus.COORDINATION_READY);
      const useCase = new GetProposalUseCase(reservationRequestRepository, proposalRepository);

      await expect(useCase.execute(request.requestId, LOGISTIC_USER_ID)).rejects.toBeInstanceOf(
        ProposalNotFoundException
      );
    });
  });

  describe("DownloadProposalUseCase", () => {
    it("returns the stored immutable PDF", async () => {
      const { request } = await setup();
      const useCase = new DownloadProposalUseCase(
        reservationRequestRepository,
        proposalRepository,
        pdfGenerator
      );

      const result = await useCase.execute(request.requestId, LOGISTIC_USER_ID);

      expect(result.fileName).toBe(FILE_NAME);
      expect(result.buffer.toString()).toContain("%PDF");
    });

    it("fails when the stored file is missing", async () => {
      const { request } = await setup();
      pdfGenerator.read = async () => {
        throw new Error("ENOENT");
      };
      const useCase = new DownloadProposalUseCase(
        reservationRequestRepository,
        proposalRepository,
        pdfGenerator
      );

      await expect(useCase.execute(request.requestId, LOGISTIC_USER_ID)).rejects.toBeInstanceOf(
        ProposalGenerationFailedException
      );
    });
  });

  describe("SendProposalUseCase", () => {
    function buildUseCase() {
      return new SendProposalUseCase(
        reservationRequestRepository,
        clientRepository,
        proposalRepository,
        pdfGenerator,
        emailService,
        auditLogRepository
      );
    }

    it("sends the PDF to the client and records the audit log (RF-2.3.4.6)", async () => {
      const { request } = await setup();

      await buildUseCase().execute(request.requestId, LOGISTIC_USER_ID);

      expect(emailService.sent).toHaveLength(1);
      expect(emailService.sent[0].email).toBe("andrea@gmail.com");
      expect(auditLogRepository.entries).toHaveLength(1);
      expect(auditLogRepository.entries[0]).toMatchObject({
        userId: LOGISTIC_USER_ID,
        action: "PROPOSAL_SENT",
        newData: { recipient: "andrea@gmail.com", proposals_code: "PROP-2026-0001" },
      });
    });

    it("reports the ERS message when the email fails (RF-2.3.4.6)", async () => {
      const { request } = await setup();
      emailService.sendProposalEmail = async () => {
        throw new Error("SMTP down");
      };

      await expect(
        buildUseCase().execute(request.requestId, LOGISTIC_USER_ID)
      ).rejects.toMatchObject({ message: "No fue posible enviar la propuesta." });
      expect(auditLogRepository.entries).toHaveLength(0);
    });

    it("rejects sending when the proposal is not visible", async () => {
      const { request } = await setup(ReservationRequestStatus.ASSIGNED);

      await expect(
        buildUseCase().execute(request.requestId, LOGISTIC_USER_ID)
      ).rejects.toBeInstanceOf(ProposalNotFoundException);
    });
  });
});
