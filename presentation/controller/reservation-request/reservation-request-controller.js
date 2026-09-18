const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

class ReservationRequestController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  async create(request, response) {
    const result = await this.dependencies.createReservationRequestUseCase.execute(request.body);

    response.status(201).json(result);
  }

  async list(request, response) {
    const result = await this.dependencies.getReservationRequestsUseCase.execute({
      page: this.parsePositiveInteger(request.query.page, 1),
      perPage: this.parsePositiveInteger(request.query.per_page, 10),
    });

    response.json(result);
  }

  async getById(request, response) {
    const id = this.parseId(request.params.id);
    const result = await this.dependencies.getReservationRequestUseCase.execute(id);

    response.json(result);
  }

  async approve(request, response) {
    const status = request.body?.status;

    if (status !== ReservationRequestStatus.APPROVED) {
      response.status(400).json({ message: `Status must be ${ReservationRequestStatus.APPROVED}` });
      return;
    }

    const result = await this.dependencies.approveReservationRequestUseCase.execute(
      this.parseId(request.params.id)
    );

    response.json(result);
  }

  parseId(value) {
    const id = Number(typeof value === "string" ? value : NaN);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid reservation request id");
    }

    return id;
  }

  parsePositiveInteger(value, fallback) {
    const parsed = Number(typeof value === "string" ? value : NaN);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}

module.exports = { ReservationRequestController };
