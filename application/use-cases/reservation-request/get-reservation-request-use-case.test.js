const { GetReservationRequestUseCase } = require("./get-reservation-request-use-case");
const { AdminRequestMessages } = require("../../../domain/constants/admin-request-messages");

function assignment(overrides) {
  return {
    id: 1,
    name: "Recurso",
    type: "MATERIAL",
    operative_role_id: null,
    operative_role: null,
    total_quantity: 20,
    is_active: true,
    requested_quantity: 5,
    quantity: 5,
    sufficiency: "SUFFICIENT",
    status: "CONFIRMED",
    observation: null,
    ...overrides,
  };
}

function buildUseCase(found, blocking = []) {
  return new GetReservationRequestUseCase({
    findById: async () => found,
    findBlockingAssignments: async () => blocking,
  });
}

describe("GetReservationRequestUseCase (DAD v3.0, RF-1.2.5.3 / RF-1.2.11.2)", () => {
  const start = new Date("2026-11-15T18:00:00-06:00");
  const end = new Date("2026-11-15T23:00:00-06:00");

  it("groups assignments by type and computes the available quantity", async () => {
    const result = await buildUseCase(
      {
        request: { request_id: 10, folio: "BD-2026-00001" },
        currentStart: start,
        currentEnd: end,
        assignments: [
          assignment({
            id: 15,
            name: "Ana López",
            type: "HUMAN",
            operative_role_id: 2,
            operative_role: "Mesero",
            total_quantity: 1,
            requested_quantity: 1,
            quantity: 1,
          }),
          assignment({ id: 8, name: "Mesa redonda", observation: "Faltan 2 mesas" }),
        ],
      },
      // Otra solicitud ocupa 6 mesas en un horario traslapado.
      [{ requestId: 99, resourceId: 8, quantity: 6, eventStart: start, eventEnd: end }]
    ).execute(10);

    expect(result.data.resource_assignments).toEqual({
      human: [
        {
          id: 15,
          name: "Ana López",
          type: "HUMAN",
          operative_role_id: 2,
          operative_role: "Mesero",
          assignment: {
            requested_quantity: 1,
            assigned_quantity: 1,
            available_quantity: 1,
            sufficiency: "Suficiente",
            status: "Confirmada",
            observation: null,
          },
        },
      ],
      material: [
        {
          id: 8,
          name: "Mesa redonda",
          type: "MATERIAL",
          assignment: {
            requested_quantity: 5,
            assigned_quantity: 5,
            available_quantity: 14,
            sufficiency: "Suficiente",
            status: "Confirmada",
            observation: "Faltan 2 mesas",
          },
        },
      ],
      logistic: [],
    });
    expect(result.data.folio).toBe("BD-2026-00001");
  });

  it("responds 404 with the DAD message when the request does not exist", async () => {
    await expect(buildUseCase(null).execute(1)).rejects.toMatchObject({
      status: 404,
      message: AdminRequestMessages.REQUEST_NOT_FOUND,
    });
  });
});
