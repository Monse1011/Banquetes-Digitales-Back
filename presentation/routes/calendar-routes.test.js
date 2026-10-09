/* global vi */
const request = require("supertest");
const { createApp } = require("../app");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid_token";

const mockSchedule = vi.fn();
const mockEdit = vi.fn();
const mockCancel = vi.fn();
const mockList = vi.fn();
const mockRetrySync = vi.fn();

function buildApp(role) {
  return createApp({
    authController: { login: vi.fn(), changePassword: vi.fn(), firstAccess: vi.fn() },
    passwordResetController: { requestReset: vi.fn(), resetPassword: vi.fn() },
    tokenService: { verifyToken: () => ({ id_user: 1, role }) },
    scheduleEventUseCase: { execute: mockSchedule },
    editEventUseCase: { execute: mockEdit },
    cancelEventUseCase: { execute: mockCancel },
    listCalendarEventsUseCase: { execute: mockList },
    retryCalendarSyncUseCase: { execute: mockRetrySync },
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
        .get("/api/calendar?date=2024-01-01&include_cancelled=false")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
    });

    it("schedules an event", async () => {
      mockSchedule.mockResolvedValue({
        id: 1,
        syncStatus: "Sincronizado",
      });

      const response = await request(app)
        .post("/api/calendar")
        .set("Cookie", AUTH_COOKIE)
        .send({ request_id: 123 });

      expect(response.status).toBe(201);
      expect(mockSchedule).toHaveBeenCalledWith(123, expect.any(Object));
    });

    it("edits an event", async () => {
      mockEdit.mockResolvedValue({
        id: 1,
        syncStatus: "Sincronizado",
      });

      const response = await request(app).put("/api/calendar/1").set("Cookie", AUTH_COOKIE).send({
        start_at: "2024-01-01T10:00:00Z",
        end_at: "2024-01-01T12:00:00Z",
        location: "Loc",
      });

      expect(response.status).toBe(200);
      expect(mockEdit).toHaveBeenCalledWith(1, expect.any(Object), {
        startAt: "2024-01-01T10:00:00Z",
        endAt: "2024-01-01T12:00:00Z",
        location: "Loc",
      });
    });

    it("cancels an event", async () => {
      mockCancel.mockResolvedValue({
        id: 1,
        syncStatus: "Sincronizado",
      });

      const response = await request(app)
        .delete("/api/calendar/1")
        .set("Cookie", AUTH_COOKIE)
        .send({ confirmed: true });

      expect(response.status).toBe(200);
      expect(mockCancel).toHaveBeenCalledWith(1, expect.any(Object), true);
    });

    it("retries sync", async () => {
      mockRetrySync.mockResolvedValue({
        id: 1,
        syncStatus: "Pendiente de sincronización",
      });

      const response = await request(app).post("/api/calendar/1/sync").set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(mockRetrySync).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  it("requires authentication", async () => {
    app = buildApp(UserRole.ADMIN);
    const response = await request(app).get("/api/calendar");
    expect(response.status).toBe(401);
  });
});
