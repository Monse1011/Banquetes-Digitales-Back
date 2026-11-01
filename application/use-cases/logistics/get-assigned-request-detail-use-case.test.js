/* global vi */
const GetAssignedRequestDetailUseCase = require("./get-assigned-request-detail-use-case");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");

describe("GetAssignedRequestDetailUseCase (Función 3.1)", () => {
  function makeRequest({
    id = 1,
    folio = "EVT-2026-0101",
    logisticUserId = 10,
    status = "Asignada",
    eventDateTime = new Date("2026-12-24T18:00:00Z"),
    clientName = "Andrea Morales",
    clientEmail = "andrea@gmail.com",
    clientPhone = "9991234567",
    eventAddress = "Salón Los Pinos Mérida",
  }) {
    const endDateTime = new Date(eventDateTime.getTime() + 5 * 60 * 60 * 1000);
    const request = new ReservationRequest(
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
      clientPhone
    );
    request.services = [
      {
        service_id: 1,
        service_name: "Banquete",
        required_resources: [
          { type: "human", resource_or_operative_role: "Chef", quantity: 2 },
          { type: "material", resource_or_operative_role: "Vajilla completa", quantity: 150 },
        ],
      },
    ];
    return request;
  }

  it("returns assigned request detail with client data and proposed schedule (NC 13, RF-2.3.1.3)", async () => {
    const request = makeRequest({ id: 1, logisticUserId: 10, status: "Asignada" });
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(request),
    };

    const useCase = new GetAssignedRequestDetailUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({ requestId: 1, userId: 10 });
    const { data } = result;

    expect(data.folio).toBe("EVT-2026-0101");
    expect(data.client).toEqual({
      client_name: "Andrea Morales",
      client_email: "andrea@gmail.com",
      client_phone: "9991234567",
    });
    expect(data.schedule_type).toBe("propuesto");
    expect(data.selected_services).toHaveLength(1);
    expect(data.selected_services[0].required_resources).toHaveLength(2);
  });

  it("displays schedule_type as 'confirmado' when status is Confirmado (RF-2.3.1.3)", async () => {
    const request = makeRequest({ id: 2, logisticUserId: 10, status: "Confirmado" });
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(request),
    };

    const useCase = new GetAssignedRequestDetailUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({ requestId: 2, userId: 10 });

    expect(result.data.schedule_type).toBe("confirmado");
  });

  it.each([
    ["Coordinación Lista", true],
    ["Coordinación Incompleta", true],
    ["Ajustes Solicitados", true],
    ["Asignada", false],
    ["En revisión", false],
  ])(
    "enables agreements for the domain status %s → %s (RF-3.4.4.5.7)",
    async (status, expected) => {
      const useCase = new GetAssignedRequestDetailUseCase({
        reservationRequestRepository: {
          findById: vi.fn().mockResolvedValue(makeRequest({ status })),
        },
      });

      const { data } = await useCase.execute({ requestId: 1, userId: 10 });

      expect(data.can_register_agreements).toBe(expected);
    }
  );

  it("lists the client's adjustment requests with the current proposal (RF-3.4.4.5.6)", async () => {
    const useCase = new GetAssignedRequestDetailUseCase({
      reservationRequestRepository: {
        findById: vi.fn().mockResolvedValue(makeRequest({ status: "Ajustes Solicitados" })),
      },
      proposalRepository: {
        findCurrentByRequestId: vi.fn().mockResolvedValue({
          proposalsCode: "PROP-2026-0001",
          version: 1,
          viewedAt: new Date("2026-10-29T20:00:00Z"),
        }),
      },
      proposalAdjustmentRepository: {
        findByRequestId: vi.fn().mockResolvedValue([
          {
            id: 7,
            observations: "Agregar 2 meseros",
            createdAt: new Date("2026-10-29T21:00:00Z"),
          },
        ]),
      },
    });

    const { data } = await useCase.execute({ requestId: 1, userId: 10 });

    expect(data.proposal_viewed_at).toBe("2026-10-29T20:00:00.000Z");
    expect(data.adjustments).toEqual([
      {
        id: 7,
        proposals_code: "PROP-2026-0001",
        version: 1,
        observations: "Agregar 2 meseros",
        requested_at: "2026-10-29T21:00:00.000Z",
      },
    ]);
  });

  it("defaults unrecorded optional fields to 'Sin registrar' (RF-2.3.1.4)", async () => {
    const request = makeRequest({
      id: 3,
      logisticUserId: 10,
      clientPhone: null,
      eventAddress: null,
    });
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(request),
    };

    const useCase = new GetAssignedRequestDetailUseCase({
      reservationRequestRepository: mockRepo,
    });

    const result = await useCase.execute({ requestId: 3, userId: 10 });

    expect(result.data.client.client_phone).toBe("Sin registrar");
    expect(result.data.event_address).toBe("Sin registrar");
  });

  it("denies access with 403 when request is assigned to another user (RF-2.3.1.7)", async () => {
    const request = makeRequest({ id: 4, logisticUserId: 20 });
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(request),
    };

    const useCase = new GetAssignedRequestDetailUseCase({
      reservationRequestRepository: mockRepo,
    });

    await expect(useCase.execute({ requestId: 4, userId: 10 })).rejects.toMatchObject({
      status: 403,
      message: "No tiene permisos para acceder a esta solicitud.",
    });
  });

  it("throws 404 when request is not found", async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };

    const useCase = new GetAssignedRequestDetailUseCase({
      reservationRequestRepository: mockRepo,
    });

    await expect(useCase.execute({ requestId: 999, userId: 10 })).rejects.toMatchObject({
      status: 404,
      message: "Solicitud de reservación no encontrada.",
    });
  });
});
