import { ApproveReservationRequestUseCase } from "../application/use-cases/reservation-request/approve-reservation-request-use-case";
import { CreateReservationRequestUseCase } from "../application/use-cases/reservation-request/create-reservation-request-use-case";
import { GetReservationRequestUseCase } from "../application/use-cases/reservation-request/get-reservation-request-use-case";
import { GetReservationRequestsUseCase } from "../application/use-cases/reservation-request/get-reservation-requests-use-case";
import { UpsertClientByEmailUseCase } from "../application/use-cases/client/upsert-client-by-email-use-case";
import { Service } from "../domain/entities/service";
import { InMemoryClientRepository } from "../infrastructure/repositories/in-memory-client-repository";
import { InMemoryReservationRequestRepository } from "../infrastructure/repositories/in-memory-reservation-request-repository";
import { InMemoryServiceRepository } from "../infrastructure/repositories/in-memory-service-repository";
import { InMemoryFolioGenerator } from "../infrastructure/services/in-memory-folio-generator";
import { createApp } from "../presentation/app";

const clientRepository = new InMemoryClientRepository();
const reservationRequestRepository = new InMemoryReservationRequestRepository();
const serviceRepository = new InMemoryServiceRepository([
  new Service(1, "Banquetes y bebidas", null, "Activo"),
  new Service(2, "Barra de cocteles", null, "Activo"),
  new Service(3, "Decoracion", null, "Activo"),
  new Service(4, "Musica", null, "Activo"),
  new Service(5, "Fotografia", null, "Activo"),
  new Service(6, "Animacion", null, "Activo"),
  new Service(7, "Servicio de personal", null, "Activo"),
  new Service(8, "Transporte", null, "Activo"),
]);
const app = createApp({
  serviceRepository,
  createReservationRequestUseCase: new CreateReservationRequestUseCase(
    new UpsertClientByEmailUseCase(clientRepository),
    reservationRequestRepository,
    new InMemoryFolioGenerator(),
  ),
  getReservationRequestsUseCase: new GetReservationRequestsUseCase(
    reservationRequestRepository,
    clientRepository,
    serviceRepository,
  ),
  getReservationRequestUseCase: new GetReservationRequestUseCase(
    reservationRequestRepository,
    clientRepository,
    serviceRepository,
  ),
  approveReservationRequestUseCase: new ApproveReservationRequestUseCase(
    reservationRequestRepository,
  ),
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port);
