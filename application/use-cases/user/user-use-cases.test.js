/* global vi */
const CreateUserUseCase = require("./create-user-use-case");
const UpdateUserUseCase = require("./update-user-use-case");
const ToggleUserStatusUseCase = require("./toggle-user-status-use-case");
const GetUserByIdUseCase = require("./get-user-by-id-use-case");
const ListUsersUseCase = require("./list-users-use-case");
const ResendCredentialsUseCase = require("./resend-credentials-use-case");
const InMemoryUserRepository = require("../../../infrastructure/repositories/user/in-memory-user-repository");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/user/user-status");
const {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");

describe("User Management Use Cases (Función 2.12)", () => {
  let userRepository;
  let emailService;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    emailService = {
      sendCredentials: vi.fn().mockResolvedValue(true),
    };
  });

  describe("NC 09 - Role Enum validation and normalization", () => {
    it("accepts valid roles ADMIN and LOGISTICS", async () => {
      const useCase = new CreateUserUseCase({ userRepository, emailService });

      const admin = await useCase.execute({
        full_name: "Admin User",
        email: "admin@test.com",
        role: "ADMIN",
      });
      expect(admin.role).toBe(UserRole.ADMIN);

      const logistics = await useCase.execute({
        full_name: "Logistics User",
        email: "logistics@test.com",
        role: "LOGISTICS",
      });
      expect(logistics.role).toBe(UserRole.LOGISTICS);
    });

    it("normalizes lowercase role and alias LOGISTIC / LOGISTICA to LOGISTICS", async () => {
      const useCase = new CreateUserUseCase({ userRepository, emailService });

      const user1 = await useCase.execute({
        full_name: "User 1",
        email: "u1@test.com",
        role: "logistics",
      });
      expect(user1.role).toBe(UserRole.LOGISTICS);

      const user2 = await useCase.execute({
        full_name: "User 2",
        email: "u2@test.com",
        role: "LOGISTIC",
      });
      expect(user2.role).toBe(UserRole.LOGISTICS);

      const user3 = await useCase.execute({
        full_name: "User 3",
        email: "u3@test.com",
        role: "admin",
      });
      expect(user3.role).toBe(UserRole.ADMIN);
    });

    it("rejects invalid role with 400 error", async () => {
      const useCase = new CreateUserUseCase({ userRepository, emailService });

      await expect(
        useCase.execute({
          full_name: "Bad Role User",
          email: "bad@test.com",
          role: "SUPERADMIN",
        })
      ).rejects.toThrow("Rol de usuario no válido. Debe ser ADMIN o LOGISTICS.");
    });

    it("normalizes and validates role in UpdateUserUseCase as well", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      const created = await createUseCase.execute({
        full_name: "Edit User",
        email: "edit@test.com",
        role: "LOGISTICS",
      });

      const updateUseCase = new UpdateUserUseCase({ userRepository });
      const updated = await updateUseCase.execute(created.id, {
        role: "admin",
      });
      expect(updated.role).toBe(UserRole.ADMIN);

      await expect(
        updateUseCase.execute(created.id, {
          role: "INVALID_ROLE",
        })
      ).rejects.toThrow("Rol de usuario no válido. Debe ser ADMIN o LOGISTICS.");
    });
  });

  describe("NC 10 - Email failure handling and credential rollback/resend", () => {
    it("fails with 500 and descriptive message when email sending fails, rolling back user creation", async () => {
      emailService.sendCredentials = vi.fn().mockRejectedValue(new Error("SMTP server down"));
      const useCase = new CreateUserUseCase({ userRepository, emailService });

      await expect(
        useCase.execute({
          full_name: "Failing Email",
          email: "fail@test.com",
          role: "LOGISTICS",
        })
      ).rejects.toThrow("No se pudo enviar el correo con las credenciales temporales");

      // Verify rollback occurred: user was removed so they don't block subsequent retry
      const inRepo = await userRepository.findByEmail("fail@test.com");
      expect(inRepo).toBeNull();

      // Should be able to register again once email succeeds
      emailService.sendCredentials = vi.fn().mockResolvedValue(true);
      const retryUser = await useCase.execute({
        full_name: "Failing Email",
        email: "fail@test.com",
        role: "LOGISTICS",
      });
      expect(retryUser.id).toBeDefined();
    });

    it("ResendCredentialsUseCase regenerates temporary password and sends new credentials", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      const user = await createUseCase.execute({
        full_name: "Resend Target",
        email: "resend@test.com",
        role: "LOGISTICS",
      });

      const resendUseCase = new ResendCredentialsUseCase({ userRepository, emailService });
      const result = await resendUseCase.execute(user.id);

      expect(result.message).toContain("Credenciales temporales regeneradas");
      expect(emailService.sendCredentials).toHaveBeenCalledTimes(2);
    });
  });

  describe("NC 11 - Active reservation request status checking with Enum", () => {
    it("ActiveReservationRequestStatuses includes required active statuses from RF-1.2.12.10", () => {
      expect(ActiveReservationRequestStatuses).toContain(ReservationRequestStatus.ASSIGNED);
      expect(ActiveReservationRequestStatuses).toContain(
        ReservationRequestStatus.COORDINATION_READY
      );
      expect(ActiveReservationRequestStatuses).toContain(
        ReservationRequestStatus.COORDINATION_INCOMPLETE
      );
      expect(ActiveReservationRequestStatuses).toContain(
        ReservationRequestStatus.PROPOSAL_GENERATED
      );
      expect(ActiveReservationRequestStatuses).toContain(ReservationRequestStatus.CONFIRMED);
    });

    it("blocks modifying user role when user has active requests", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      const user = await createUseCase.execute({
        full_name: "Active Logistics",
        email: "active@test.com",
        role: "LOGISTICS",
      });

      userRepository.setActiveRequests(user.id, true);

      const updateUseCase = new UpdateUserUseCase({ userRepository });
      await expect(updateUseCase.execute(user.id, { role: "ADMIN" })).rejects.toThrow(
        "El usuario tiene solicitudes asignadas activas y su rol no puede modificarse."
      );
    });

    it("blocks deactivating user when user has active requests", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      const user = await createUseCase.execute({
        full_name: "Active Logistic 2",
        email: "active2@test.com",
        role: "LOGISTICS",
      });

      userRepository.setActiveRequests(user.id, true);

      const toggleUseCase = new ToggleUserStatusUseCase({ userRepository });
      await expect(
        toggleUseCase.execute(user.id, { status: UserStatus.INACTIVE, currentUserId: 999 })
      ).rejects.toThrow("El usuario tiene solicitudes asignadas activas y no puede eliminarse.");
    });
  });

  describe("NC 12 - Employee ID format and technical justification", () => {
    it("generates employee_id matching EMP-[100-999]", async () => {
      const useCase = new CreateUserUseCase({ userRepository, emailService });
      const empId = useCase.generateEmployeeId();

      expect(empId).toMatch(/^EMP-\d{3}$/);
      const num = parseInt(empId.replace("EMP-", ""), 10);
      expect(num).toBeGreaterThanOrEqual(100);
      expect(num).toBeLessThan(1000);
    });
  });

  describe("General user operations (List, GetById, ToggleStatus)", () => {
    it("lists users with pagination and filtering", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      await createUseCase.execute({
        full_name: "Carlos Sanchez",
        email: "carlos@test.com",
        role: "ADMIN",
      });
      await createUseCase.execute({
        full_name: "Maria Lopez",
        email: "maria@test.com",
        role: "LOGISTICS",
      });

      const listUseCase = new ListUsersUseCase({ userRepository });
      const list = await listUseCase.execute({ search: "carlos" });
      expect(list.users.length).toBe(1);
      expect(list.users[0].full_name).toBe("Carlos Sanchez");
      expect(list.pagination.total_records).toBe(1);
    });

    it("gets user by id with assigned requests if logistics", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      const user = await createUseCase.execute({
        full_name: "Sofia Log",
        email: "sofia@test.com",
        role: "LOGISTICS",
      });

      userRepository.setAssignedRequests(user.id, [{ id: 1, folio: "EVT-2026-001" }]);

      const getByIdUseCase = new GetUserByIdUseCase({ userRepository });
      const detail = await getByIdUseCase.execute(user.id);
      expect(detail.id).toBe(user.id);
      expect(detail.assigned_requests).toHaveLength(1);
    });

    it("prevents self-deactivation and single active admin deactivation", async () => {
      const createUseCase = new CreateUserUseCase({ userRepository, emailService });
      const admin = await createUseCase.execute({
        full_name: "Sole Admin",
        email: "admin1@test.com",
        role: "ADMIN",
      });

      const toggleUseCase = new ToggleUserStatusUseCase({ userRepository });

      // Self deactivation
      await expect(
        toggleUseCase.execute(admin.id, { status: UserStatus.INACTIVE, currentUserId: admin.id })
      ).rejects.toThrow("No se permite desactivar la propia cuenta en sesión.");

      // Single active admin deactivation
      await expect(
        toggleUseCase.execute(admin.id, { status: UserStatus.INACTIVE, currentUserId: 999 })
      ).rejects.toThrow("No se permite desactivar al único Administrador General activo.");
    });
  });
});
