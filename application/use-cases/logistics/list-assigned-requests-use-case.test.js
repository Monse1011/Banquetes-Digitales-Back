/* global vi */
const ListAssignedRequestsUseCase = require("./list-assigned-requests-use-case");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");

describe("ListAssignedRequestsUseCase (Función 3.1)", () => {
  function makeRequest({
    id,
    folio,
    logisticUserId = 10,
    status = "Asignada",
    eventDateTime = new Date("2026-12-24T18:00:00Z"),
    clientName = "Andrea Morales",
    clientEmail = "andrea@gmail.com",
    eventAddress = "Salón Los Pinos Mérida",
  }) {
    const endDateTime = new Date(eventDateTime.getTime() + 4 * 60 * 60 * 1000);
    return new ReservationRequest(
      id,
      folio,
      1,
      1,
      eventDateTime,
      endDateTime,
      150,
      eventAddress,
      status,
      new Date(),
      [1],
      logisticUserId,
      null,
      null,
      clientName,
      clientEmail,
      "9991234567"
    );
  }

  it("passes database-level filters, sort and pagination to repository.findAll (NC 14)", async () => {
    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({
        requests: [makeRequest({ id: 1, folio: "EVT-001" })],
        totalRecords: 1,
      }),
    };

    const useCase = new ListAssignedRequestsUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({
      userId: 10,
      status: "Asignada",
      page: 2,
      perPage: 5,
    });

    expect(mockRepo.findAll).toHaveBeenCalledWith(
      {
        logisticUserId: 10,
        status: ["Asignada", "ASIGNADA"],
      },
      { field: "EVENT_DATE", direction: "asc" },
      2,
      5
    );

    expect(result.data.requests).toHaveLength(1);
    expect(result.data.requests[0].folio).toBe("EVT-001");
    expect(result.metadata.pagination).toEqual({
      total_records: 1,
      page: 2,
      per_page: 5,
    });
  });

  it("returns explicit message when logistics user has no assigned requests (NC 15, RF-2.3.1.2)", async () => {
    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({
        requests: [],
        totalRecords: 0,
      }),
    };

    const useCase = new ListAssignedRequestsUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({
      userId: 99,
      page: 1,
      perPage: 10,
    });

    expect(result.message).toBe("No tiene solicitudes de eventos asignadas.");
    expect(result.data.requests).toEqual([]);
    expect(result.data.message).toBe("No tiene solicitudes de eventos asignadas.");
    expect(result.metadata.pagination.total_records).toBe(0);
  });

  it("sorts by event date and start time ascending with folio tie breaker (NC 17, RF-2.3.1.5)", async () => {
    const request1 = makeRequest({
      id: 1,
      folio: "EVT-003",
      eventDateTime: new Date("2026-12-25T14:00:00Z"),
    });
    const request2 = makeRequest({
      id: 2,
      folio: "EVT-001",
      eventDateTime: new Date("2026-12-24T18:00:00Z"),
    });
    const request3 = makeRequest({
      id: 3,
      folio: "EVT-002",
      eventDateTime: new Date("2026-12-24T18:00:00Z"),
    });

    const mockRepo = {
      findAll: vi.fn().mockResolvedValue([request1, request2, request3]),
    };

    const useCase = new ListAssignedRequestsUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({ userId: 10 });
    const folios = result.data.requests.map((request) => request.folio);

    expect(folios).toEqual(["EVT-001", "EVT-002", "EVT-003"]);
  });

  it("populates client info and defaults missing optional address to 'Sin registrar' (NC 13, RF-2.3.1.4)", async () => {
    const request = makeRequest({
      id: 1,
      folio: "EVT-001",
      clientName: "Andrea Morales",
      clientEmail: "andrea@gmail.com",
      eventAddress: null,
    });

    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({
        requests: [request],
        totalRecords: 1,
      }),
    };

    const useCase = new ListAssignedRequestsUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({ userId: 10 });
    const dto = result.data.requests[0];

    expect(dto.client_name).toBe("Andrea Morales");
    expect(dto.client_email).toBe("andrea@gmail.com");
    expect(dto.event_address).toBe("Sin registrar");
  });

  it("rejects an invalid active status filter with 400", async () => {
    const mockRepo = {
      findAll: vi.fn(),
    };

    const useCase = new ListAssignedRequestsUseCase({
      reservationRequestRepository: mockRepo,
    });

    await expect(useCase.execute({ userId: 10, status: "ESTADO_INEXISTENTE" })).rejects.toThrow(
      "El estado indicado no es válido para solicitudes activas."
    );
  });
});
