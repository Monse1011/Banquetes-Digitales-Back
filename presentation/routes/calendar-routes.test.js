/* global vi */
const request = require("supertest");
const { createApp } = require("../app");
const UserRole = require("../../domain/enums/auth/user-role");
const CalendarAccessDeniedException = require("../../domain/exceptions/calendar/calendar-access-denied-exception");
const CalendarValidationException = require("../../domain/exceptions/calendar/calendar-validation-exception");

const AUTH_COOKIE = "auth_token=valid_token";

const mockSchedule = vi.fn();
const mockEdit = vi.fn();
const mockCancel = vi.fn();
const mockList = vi.fn();
const mockRetry = vi.fn();

function buildApp(role) {
  return createApp({
    authController: {
      session: (_req, res) => res.sendStatus(501),
      logout: (_req, res) => res.sendStatus(501),
      login: vi.fn(),
      changePassword: vi.fn(),
      firstAccess: vi.fn(),
    },
    passwordResetController: { requestReset: vi.fn(), resetPassword: vi.fn() },
    tokenService: { verifyToken: () => ({ id_user: 1, role }) },
    scheduleEventUseCase: { execute: mockSchedule },
    editEventUseCase: { execute: mockEdit },
    cancelEventUseCase: { execute: mockCancel },
    retryCalendarSyncUseCase: { execute: mockRetry },
    listCalendarEventsUseCase: { execute: mockList },
    // Mock other use cases
    resourceUseCases: {},
    humanResourceUseCases: {},
    materialResourceUseCases: {},
    logisticResourceUseCases: {},
  });
}

describe("Calendar Routes (Función 3.3)", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("as Administrador General", () => {
    beforeEach(() => {
      app = buildApp(UserRole.ADMIN);
    });

    it("lists events", async () => {
      mockList.mockResolvedValue({
        events: [{ id: 1, title: "Test Event" }],
        totalRecords: 1,
        page: 1,
        perPage: 10,
      });

      const response = await request(app)
        .get("/api/logistics/calendar?date=2024-01-01&include_cancelled=false")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
    });

    it("exposes the DAD administrator calendar route and contract documentation", async () => {
      mockList.mockResolvedValue({
        events: [],
        totalRecords: 0,
        page: 1,
        perPage: 10,
      });

      const response = await request(app)
        .get("/api/admin/calendar?date=2026-12-24")
        .set("Cookie", AUTH_COOKIE);
      const documentation = await request(app).get("/api-docs.json");

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-12-24" }));
      expect(documentation.body.paths["/api/logistics/calendar/{id}"].patch).toBeDefined();
      expect(documentation.body.paths["/api/logistics/calendar/{id}/sync"].post).toBeDefined();
      expect(documentation.body.paths["/api/logistics/requests/{id}/calendar"].post).toBeDefined();
      expect(documentation.body.paths["/api/calendar"]).toBeUndefined();
      expect(documentation.body.paths["/api/calendar/{id}"]).toBeUndefined();
      expect(documentation.body.paths["/api/calendar/{id}/sync"]).toBeUndefined();
      expect(
        Object.keys(documentation.body.paths)
          .filter(
            (path) =>
              path.startsWith("/api/calendar") ||
              (path.startsWith("/api/logistics/calendar") && path !== "/api/logistics/calendar") ||
              (path.startsWith("/api/admin/calendar") && path !== "/api/admin/calendar")
          )
          .sort()
      ).toEqual(["/api/logistics/calendar/{id}", "/api/logistics/calendar/{id}/sync"]);
    });

    it("edits events using the DAD route and forwards immutable fields for validation", async () => {
      mockEdit.mockResolvedValue({
        id: 1,
        syncStatus: "Sincronizado",
      });

      const response = await request(app)
        .patch("/api/logistics/calendar/1")
        .set("Cookie", AUTH_COOKIE)
        .send({
          data: {
            start_datetime: "2026-12-24 19:00:00",
            end_datetime: "2026-12-25 00:00:00",
            location: "Loc",
            logistic_user_id: 17,
            resources: [],
          },
        });

      expect(response.status).toBe(200);
      expect(mockEdit).toHaveBeenCalledWith(
        1,
        expect.any(Object),
        expect.objectContaining({
          start_datetime: "2026-12-24 19:00:00",
          end_datetime: "2026-12-25 00:00:00",
          logistic_user_id: 17,
          resources: [],
        })
      );
      expect(response.text).toBe("");
    });

    it("rejects non-DAD names for edit fields", async () => {
      mockEdit.mockRejectedValueOnce(
        new CalendarValidationException({
          start_at: "El campo no está definido por el contrato de edición.",
        })
      );
      const response = await request(app)
        .patch("/api/logistics/calendar/1")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { start_at: "2026-12-24T19:00:00Z" } });

      expect(response.status).toBe(422);
      expect(response.body.errors).toHaveProperty("start_at");
      expect(mockEdit).toHaveBeenCalledWith(1, expect.any(Object), {
        start_at: "2026-12-24T19:00:00Z",
      });
    });

    it("maps CalendarAccessDeniedException to HTTP 403 centrally", async () => {
      mockList.mockRejectedValueOnce(new CalendarAccessDeniedException());

      const response = await request(app).get("/api/logistics/calendar").set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        status: "error",
        message: expect.any(String),
      });
    });

    it("schedules from the request ID in the DAD route without a request body", async () => {
      mockSchedule.mockResolvedValue({
        event: {
          id: 1,
          requestId: 123,
          status: "Confirmado",
          syncStatus: "Sincronizado",
          googleEventId: "google-event-123",
        },
        syncWarning: null,
      });

      const response = await request(app)
        .post("/api/logistics/requests/123/calendar")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(201);
      expect(mockSchedule).toHaveBeenCalledWith(123, expect.any(Object));
      expect(response.body.data).toEqual({
        event_id: 1,
        request_id: 123,
        status: "Confirmado",
        sync_status: "Sincronizado",
        google_event_id: "google-event-123",
      });
    });

    it("cancels events from the DAD route without requiring a request body", async () => {
      mockCancel.mockResolvedValue({
        id: 1,
        syncStatus: "Sincronizado",
      });

      const response = await request(app)
        .delete("/api/logistics/calendar/1")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(mockCancel).toHaveBeenCalledWith(1, expect.any(Object));
      expect(response.text).toBe("");
    });
  });

  it("does not expose the former /api/calendar routes", async () => {
    app = buildApp(UserRole.ADMIN);

    const listing = await request(app).get("/api/calendar").set("Cookie", AUTH_COOKIE);
    const scheduling = await request(app)
      .post("/api/calendar")
      .set("Cookie", AUTH_COOKIE)
      .send({ request_id: 123 });
    const editing = await request(app)
      .put("/api/calendar/1")
      .set("Cookie", AUTH_COOKIE)
      .send({ start_at: "2026-12-24T19:00:00Z" });
    const cancel = await request(app)
      .delete("/api/calendar/1")
      .set("Cookie", AUTH_COOKIE)
      .send({ confirmed: true });
    const retry = await request(app).post("/api/calendar/1/sync").set("Cookie", AUTH_COOKIE);

    expect(listing.status).toBe(404);
    expect(scheduling.status).toBe(404);
    expect(editing.status).toBe(404);
    expect(cancel.status).toBe(404);
    expect(retry.status).toBe(404);
  });

  it("does not expose non-DAD verbs on canonical calendar paths", async () => {
    app = buildApp(UserRole.ADMIN);

    const schedule = await request(app)
      .post("/api/logistics/calendar")
      .set("Cookie", AUTH_COOKIE)
      .send({ request_id: 123 });
    const replace = await request(app)
      .put("/api/logistics/calendar/1")
      .set("Cookie", AUTH_COOKIE)
      .send({ data: { start_datetime: "2026-12-24 19:00:00" } });

    expect(schedule.status).toBe(404);
    expect(replace.status).toBe(404);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockEdit).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    app = buildApp(UserRole.ADMIN);
    const response = await request(app).get("/api/logistics/calendar");
    expect(response.status).toBe(401);
  });
});

describe("calendar retry HTTP integration", () => {
  it("returns pending state without claiming Google success", async () => {
    mockRetry.mockResolvedValue({
      event: { id: 4, syncStatus: "Pendiente de sincronización" },
      syncWarning: "No pudo sincronizarse",
    });
    const response = await request(buildApp(UserRole.ADMIN))
      .post("/api/logistics/calendar/4/sync")
      .set("Cookie", AUTH_COOKIE);
    expect(response.status).toBe(200);
    expect(mockRetry).toHaveBeenCalledWith(4, { id_user: 1, role: UserRole.ADMIN });
    expect(response.body.data.sync_status).toBe("Pendiente de sincronización");
  });
  it("preserves ownership denial from the existing use case", async () => {
    mockRetry.mockRejectedValue(new CalendarAccessDeniedException());
    const response = await request(buildApp(UserRole.LOGISTICS))
      .post("/api/logistics/calendar/4/sync")
      .set("Cookie", AUTH_COOKIE);
    expect(response.status).toBe(403);
  });
  it("rejects invalid ids and unauthenticated retries", async () => {
    expect(
      (
        await request(buildApp(UserRole.ADMIN))
          .post("/api/logistics/calendar/invalid/sync")
          .set("Cookie", AUTH_COOKIE)
      ).status
    ).toBe(422);
    expect(
      (await request(buildApp(UserRole.ADMIN)).post("/api/logistics/calendar/4/sync")).status
    ).toBe(401);
  });
});
