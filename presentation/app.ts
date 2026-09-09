import express, { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { ServiceRepository } from "../application/repositories/service-repository";
import { CreateReservationRequestUseCase } from "../application/use-cases/reservation-request/create-reservation-request-use-case";
import { ApproveReservationRequestUseCase } from "../application/use-cases/reservation-request/approve-reservation-request-use-case";
import { GetReservationRequestUseCase } from "../application/use-cases/reservation-request/get-reservation-request-use-case";
import { GetReservationRequestsUseCase } from "../application/use-cases/reservation-request/get-reservation-requests-use-case";
import { requireAdmin } from "./middleware/admin-auth";
import {
  ReservationRequestController,
  ReservationRequestControllerDependencies,
} from "./controller/reservation-request-controller";
import { ServiceController } from "./controller/service-controller";
import { openApiDocument } from "./openapi";

export interface AppDependencies extends ReservationRequestControllerDependencies {
  serviceRepository: ServiceRepository;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const reservationRequestController = new ReservationRequestController(dependencies);
  const serviceController = new ServiceController(dependencies.serviceRepository);

  app.use(express.json());
  app.get("/api-docs.json", (_request, response) => {
    response.json(openApiDocument);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.post("/api/client/request", (request, response, next) => {
    reservationRequestController.create(request, response).catch(next);
  });
  app.get("/api/client/services", (request, response, next) => {
    serviceController.list(request, response).catch(next);
  });
  app.get("/api/admin/requests", requireAdmin, (request, response, next) => {
    reservationRequestController.list(request, response).catch(next);
  });
  app.get("/api/admin/requests/:id", requireAdmin, (request, response, next) => {
    reservationRequestController.getById(request, response).catch(next);
  });
  app.patch("/api/admin/requests/:id", requireAdmin, (request, response, next) => {
    reservationRequestController.approve(request, response).catch(next);
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Reservation request not found" ? 404 : 400;

    response.status(status).json({ error: message });
  });

  return app;
}

export type {
  ApproveReservationRequestUseCase,
  CreateReservationRequestUseCase,
  GetReservationRequestUseCase,
  GetReservationRequestsUseCase,
};
