import { describe, expect, it } from "vitest";

import { ReservationRequest } from "../../domain/entities/reservation-request";
import { ReservationRequestStatus } from "../../domain/enums/request-status";
import { InMemoryReservationRequestRepository } from "./in-memory-reservation-request-repository";

describe("InMemoryReservationRequestRepository", () => {
  it("should create and retrieve a reservation request", async () => {
    const repository = new InMemoryReservationRequestRepository();

    const request = new ReservationRequest(
      undefined,
      "BD-2026-00001",
      1,
      null,
      new Date("2026-11-20T19:00:00Z"),
      120,
      "Av. Reforma 123",
      ReservationRequestStatus.Pending,
      new Date(),
      new Date(),
      [1, 2, 4, 5]
    );

    const createdRequest = await repository.create(request);

    expect(createdRequest.id).toBe(1);

    const storedRequest = await repository.findById(1);

    expect(storedRequest).not.toBeNull();
    expect(storedRequest!.folio).toBe("BD-2026-00001");
    expect(storedRequest!.clientId).toBe(1);
    expect(storedRequest!.guestCount).toBe(120);
    expect(storedRequest!.servicesIds).toEqual([1, 2, 4, 5]);
  });
});
