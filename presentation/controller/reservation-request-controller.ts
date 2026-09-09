import { Request, Response } from "express";
import { CreateReservationRequestDto } from "../../application/dto/create-reservation-req-request-dto";
import { CreateReservationRequestUseCase } from "../../application/use-cases/reservation-request/create-reservation-request-use-case";
import { ApproveReservationRequestUseCase } from "../../application/use-cases/reservation-request/approve-reservation-request-use-case";
import { GetReservationRequestUseCase } from "../../application/use-cases/reservation-request/get-reservation-request-use-case";
import { GetReservationRequestsUseCase } from "../../application/use-cases/reservation-request/get-reservation-requests-use-case";

export interface ReservationRequestControllerDependencies {
  createReservationRequestUseCase: CreateReservationRequestUseCase;
  getReservationRequestsUseCase: GetReservationRequestsUseCase;
  getReservationRequestUseCase: GetReservationRequestUseCase;
  approveReservationRequestUseCase: ApproveReservationRequestUseCase;
}

export class ReservationRequestController {
  constructor(private readonly dependencies: ReservationRequestControllerDependencies) {}

  async create(
    request: Request<Record<string, never>, unknown, CreateReservationRequestDto>,
    response: Response
  ): Promise<void> {
    const result = await this.dependencies.createReservationRequestUseCase.execute(request.body);

    response.status(201).json({ data: result });
  }

  async list(request: Request, response: Response): Promise<void> {
    const result = await this.dependencies.getReservationRequestsUseCase.execute({
      page: this.parsePositiveInteger(request.query.page, 1),
      perPage: this.parsePositiveInteger(request.query.per_page, 10),
    });

    response.json(result);
  }

  async getById(request: Request, response: Response): Promise<void> {
    const id = this.parseId(request.params.id);
    const result = await this.dependencies.getReservationRequestUseCase.execute(id);

    response.json({
      data: {
        folio: result.folio,
        client_name: result.client.full_name,
        client_email: result.client.email,
        client_phone: result.client.phone,
        guest_count: result.guest_count,
        requested_date: result.event_date_time,
        submission_date: result.request_date,
        selected_services: result.services.map((service) => service.name),
        status: result.status,
      },
    });
  }

  async approve(request: Request, response: Response): Promise<void> {
    const status = request.body?.status;

    if (status !== "Aprobado" && status !== "Aprobada") {
      response.status(400).json({ error: "Status must be Aprobado" });
      return;
    }

    const result = await this.dependencies.approveReservationRequestUseCase.execute(
      this.parseId(request.params.id)
    );

    response.json({ data: result });
  }

  private parseId(value: unknown): number {
    const id = Number(typeof value === "string" ? value : NaN);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid reservation request id");
    }

    return id;
  }

  private parsePositiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(typeof value === "string" ? value : NaN);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
