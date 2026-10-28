const ClientRequestNotFoundException = require("../../../domain/exceptions/client-proposal/client-request-not-found-exception");
const InvalidFolioFormatException = require("../../../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const ProposalGenerationFailedException = require("../../../domain/exceptions/proposal/proposal-generation-failed-exception");
const { isValidFolio, normalizeFolio } = require("../../../domain/value-objects/folio");
const { ProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const {
  resolveProposalAccess,
  ProposalAccess,
} = require("../../../domain/enums/client-proposal/proposal-access");
const { ProposalMessages } = require("../../../domain/constants/proposal-messages");

// Función 4.4 / 4.5 (RF-3.4.4.4.3, RF-3.4.5.8, RF-3.4.5.9): ver o descargar el PDF de la
// propuesta vigente. No cambia el estado ni registra visualización: solo el detalle lo hace.
class GetClientProposalPdfUseCase {
  constructor(reservationRequestRepository, proposalRepository, pdfGenerator) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.proposalRepository = proposalRepository;
    this.pdfGenerator = pdfGenerator;
  }

  async execute(rawFolio, { download = false } = {}) {
    if (!isValidFolio(rawFolio)) {
      throw new InvalidFolioFormatException();
    }

    const request = await this.reservationRequestRepository.findByFolio(normalizeFolio(rawFolio));

    // Disponible solo con proposal_access INTERACTIVE o PDF_ONLY (RF-3.4.5.8/9).
    if (!request || resolveProposalAccess(request.status) === ProposalAccess.NONE) {
      throw new ClientRequestNotFoundException();
    }

    const proposal = await this.proposalRepository.findCurrentByRequestId(request.requestId);

    if (!proposal) {
      throw new ProposalNotFoundException();
    }

    // RF-3.4.4.4.3: si está aceptada se entrega el PDF de aceptación, nunca se regenera.
    const fileName =
      proposal.status === ProposalStatus.ACCEPTED ? proposal.acceptedPdfPath : proposal.name;

    if (!fileName) {
      throw new ProposalNotFoundException();
    }

    let buffer;

    try {
      buffer = await this.pdfGenerator.read(fileName);
    } catch {
      throw new ProposalGenerationFailedException(ProposalMessages.PROPOSAL_FILE_MISSING);
    }

    return { fileName, buffer, disposition: download ? "attachment" : "inline" };
  }
}

module.exports = { GetClientProposalPdfUseCase };
