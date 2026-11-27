/* global vi */
const GetAssignedRequestsHistoryUseCase = require("./get-assigned-requests-history-use-case");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");

describe("GetAssignedRequestsHistoryUseCase (Función 3.1)", () => {
  function makeRequest({
    id,
    folio,
    logisticUserId = 10,
    status = "Finalizado",
    eventDateTime = new Date("2026-10-01T18:00:00Z"),
  }) {
    const endDateTime = new Date(eventDateTime.getTime() + 4 * 60 * 60 * 1000);
    return new ReservationRequest(
      id,
      folio,
      1,
      1,
      eventDateTime,
      endDateTime,
      100,
      "Salón Fiesta",
      status,
      new Date(),
      [1],
      logisticUserId,
      null,
      null,
      "Carlos Ruiz",
      "carlos@gmail.com",
      "9998887766"
    );
  }

  it("passes database-level filters, descending sort and pagination to repository.findAll (NC 14)", async () => {
    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({
        requests: [makeRequest({ id: 1, folio: "EVT-H01" })],
        totalRecords: 1,
      }),
    };

    const useCase = new GetAssignedRequestsHistoryUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({
      userId: 10,
      status: "Finalizado",
      page: 1,
      perPage: 10,
    });

    expect(mockRepo.findAll).toHaveBeenCalledWith(
      {
        logisticUserId: 10,
        status: ["Finalizado", "FINALIZADO"],
      },
      { field: "EVENT_DATE", direction: "desc" },
      1,
      10
    );

    expect(result.data.requests).toHaveLength(1);
    expect(result.data.requests[0].status).toBe("Finalizado");
  });

  it("sorts history descending by event date (NC 16, NC 17)", async () => {
    const older = makeRequest({
      id: 1,
      folio: "EVT-OLD",
      eventDateTime: new Date("2026-05-01T10:00:00Z"),
    });
    const newer = makeRequest({
      id: 2,
      folio: "EVT-NEW",
      eventDateTime: new Date("2026-09-01T10:00:00Z"),
    });

    const mockRepo = {
      findAll: vi.fn().mockResolvedValue([older, newer]),
    };

    const useCase = new GetAssignedRequestsHistoryUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({ userId: 10 });
    const folios = result.data.requests.map((request) => request.folio);

    expect(folios).toEqual(["EVT-NEW", "EVT-OLD"]);
  });

  it("rejects an invalid history status filter with 400", async () => {
    const mockRepo = {
      findAll: vi.fn(),
    };

    const useCase = new GetAssignedRequestsHistoryUseCase({
      reservationRequestRepository: mockRepo,
    });

    await expect(useCase.execute({ userId: 10, status: "Asignada" })).rejects.toThrow(
      "El estado indicado no es válido para el historial."
    );
  });
});
