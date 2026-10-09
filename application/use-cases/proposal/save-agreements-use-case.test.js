const { SaveAgreementsUseCase } = require("./save-agreements-use-case");
const { SaveAgreementsRequestDto } = require("../../dto/proposal/save-agreements-request-dto");
const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryAssignedResourceRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-assigned-resource-repository");
const {
  InMemoryDerivedInformationRepository,
} = require("../../../infrastructure/repositories/proposal/in-memory-derived-information-repository");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const {
  AssignedResourceStatus,
} = require("../../../domain/enums/proposal/assigned-resource-status");
const AgreementsValidationException = require("../../../domain/exceptions/proposal/agreements-validation-exception");
const RequestNotInAgreementsStateException = require("../../../domain/exceptions/proposal/request-not-in-agreements-state-exception");
const ResourceAvailabilityExceededException = require("../../../domain/exceptions/proposal/resource-availability-exceeded-exception");
const ScheduleConflictException = require("../../../domain/exceptions/proposal/schedule-conflict-exception");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");

const LOGISTIC_USER_ID = 7;
const DAY = 24 * 60 * 60 * 1000;

function futureDate(days, hour) {
  const date = new Date(Date.now() + days * DAY);

  date.setHours(hour, 0, 0, 0);

  return date;
}

describe("SaveAgreementsUseCase", () => {
  let reservationRequestRepository;
  let assignedResourceRepository;
  let derivedInformationRepository;
  let useCase;

  beforeEach(() => {
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    assignedResourceRepository = new InMemoryAssignedResourceRepository([
      { id: 1, name: "Mesero", type: ResourceType.HUMAN, unitCost: 300, totalQuantity: 5 },
      { id: 2, name: "Vajilla", type: ResourceType.MATERIAL, unitCost: 50, totalQuantity: 100 },
    ]);
    derivedInformationRepository = new InMemoryDerivedInformationRepository();
    useCase = new SaveAgreementsUseCase(
      reservationRequestRepository,
      assignedResourceRepository,
      derivedInformationRepository
    );
  });

  async function createRequest(status = ReservationRequestStatus.COORDINATION_READY) {
    return reservationRequestRepository.create(
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
  }

  function dto(overrides = {}) {
    return new SaveAgreementsRequestDto({
      location: "Salón Los Pinos Mérida",
      start_datetime: futureDate(10, 18).toISOString(),
      end_datetime: futureDate(10, 23).toISOString(),
      observations: "Montaje imperial",
      adjusted_resources: [
        { resource_id: 1, quantity: 2 },
        { resource_id: 2, quantity: 50 },
      ],
      ...overrides,
    });
  }

  it("saves agreements with user and timestamp without changing the status", async () => {
    const request = await createRequest();

    const result = await useCase.execute(request.requestId, LOGISTIC_USER_ID, dto());

    expect(result.data.derived_information_id).toBe(1);

    const saved = await derivedInformationRepository.findByIdAndRequestId(1, request.requestId);

    expect(saved.location).toBe("Salón Los Pinos Mérida");
    expect(saved.createdByUserId).toBe(LOGISTIC_USER_ID);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect((await reservationRequestRepository.findById(request.requestId)).status).toBe(
      ReservationRequestStatus.COORDINATION_READY
    );
  });

  it("updates assignments releasing the replaced quantities (RF-2.3.4.9)", async () => {
    const request = await createRequest();
    assignedResourceRepository.addAssignment({
      requestId: request.requestId,
      resourceId: 1,
      quantity: 4,
      usageStart: request.eventDateTime,
      usageEnd: request.eventEndTime,
      status: AssignedResourceStatus.CONFIRMED,
    });

    await useCase.execute(request.requestId, LOGISTIC_USER_ID, dto());

    const active = await assignedResourceRepository.findActiveByRequestId(request.requestId);
    const human = active.find((assignment) => assignment.resourceId === 1);

    expect(human.quantity).toBe(2);
    expect(
      assignedResourceRepository.assignments.filter(
        (assignment) =>
          assignment.resourceId === 1 && assignment.status === AssignedResourceStatus.RELEASED
      ).length
    ).toBe(1);
  });

  it("rejects requests of another responsible (RF-2.3.4.12)", async () => {
    const request = await createRequest();

    await expect(useCase.execute(request.requestId, 999, dto())).rejects.toBeInstanceOf(
      ReservationRequestNotFoundException
    );
  });

  it("rejects states outside coordination (RF-2.3.4.1)", async () => {
    const request = await createRequest(ReservationRequestStatus.ASSIGNED);

    await expect(
      useCase.execute(request.requestId, LOGISTIC_USER_ID, dto())
    ).rejects.toBeInstanceOf(RequestNotInAgreementsStateException);
  });

  it("validates required fields with the ERS messages (RF-2.3.4.3)", async () => {
    const request = await createRequest();

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        dto({
          location: "",
          start_datetime: futureDate(10, 23).toISOString(),
          end_datetime: futureDate(10, 18).toISOString(),
        })
      )
    ).rejects.toMatchObject({
      errors: {
        location: "El campo ubicación es obligatorio.",
        end_datetime: "La hora de fin debe ser posterior a la hora de inicio.",
      },
    });

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        dto({ start_datetime: new Date(Date.now() - DAY).toISOString() })
      )
    ).rejects.toBeInstanceOf(AgreementsValidationException);
  });

  it("rejects adjusted quantities over the confirmed schedule availability (RF-2.3.4.8)", async () => {
    const request = await createRequest();
    const otherRequest = await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        "EVT-2026-0102",
        2,
        null,
        futureDate(10, 19),
        futureDate(10, 22),
        50,
        "Otro salón",
        ReservationRequestStatus.CONFIRMED,
        new Date(),
        [],
        8,
        1,
        new Date()
      )
    );
    assignedResourceRepository.addAssignment({
      requestId: otherRequest.requestId,
      resourceId: 1,
      quantity: 4,
      usageStart: otherRequest.eventDateTime,
      usageEnd: otherRequest.eventEndTime,
      status: AssignedResourceStatus.CONFIRMED,
    });

    const promise = useCase.execute(request.requestId, LOGISTIC_USER_ID, dto());

    await expect(promise).rejects.toBeInstanceOf(ResourceAvailabilityExceededException);
    await expect(promise).rejects.toMatchObject({
      conflicts: [
        {
          resource_id: 1,
          available: 1,
          message:
            "La cantidad ajustada de Mesero excede la disponibilidad (1) para el horario indicado.",
        },
      ],
    });
  });

  it("rejects confirmed schedules that overlap the responsible agenda (RF-2.3.4.10)", async () => {
    const request = await createRequest();
    await reservationRequestRepository.create(
      new ReservationRequest(
        null,
        "EVT-2026-0103",
        2,
        null,
        futureDate(11, 18),
        futureDate(11, 22),
        50,
        "Otro salón",
        ReservationRequestStatus.ASSIGNED,
        new Date(),
        [],
        LOGISTIC_USER_ID,
        1,
        new Date()
      )
    );

    await expect(
      useCase.execute(
        request.requestId,
        LOGISTIC_USER_ID,
        dto({
          start_datetime: futureDate(11, 19).toISOString(),
          end_datetime: futureDate(11, 23).toISOString(),
        })
      )
    ).rejects.toBeInstanceOf(ScheduleConflictException);
  });
});
