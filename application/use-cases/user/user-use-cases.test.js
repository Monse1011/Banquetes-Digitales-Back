/* global vi */
const CreateUserUseCase = require("./create-user-use-case");
const UpdateUserUseCase = require("./update-user-use-case");
const ToggleUserStatusUseCase = require("./toggle-user-status-use-case");
const GetUserByIdUseCase = require("./get-user-by-id-use-case");
const ListUsersUseCase = require("./list-users-use-case");
const ResendUserCredentialsUseCase = require("./resend-user-credentials-use-case");
const CredentialsDeliveryException = require("../../../domain/exceptions/user/credentials-delivery-exception");
const { generateUniqueEmployeeId } = require("../../services/user/employee-id-generator");
const UserRepositoryImpl = require("../../../infrastructure/repositories/user/user-repository-impl");
const InMemoryUserRepository = require("../../../infrastructure/repositories/user/in-memory-user-repository");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/user/user-status");
const {
  ReservationRequestStatus,
  UserResponsibilityReservationRequestStatuses,
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

    it("accepts only the exact UserRole values of the DAD (single enum, no aliases)", async () => {
      expect(Object.entries(UserRole)).toEqual([
        ["ADMIN", "ADMIN"],
        ["LOGISTICS", "LOGISTICS"],
      ]);

      const useCase = new CreateUserUseCase({ userRepository, emailService });
      const invalidRoles = ["logistics", "admin", "LOGISTIC", "LOGISTICA", " ADMIN"];
      for (const [index, role] of invalidRoles.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await expect(
          useCase.execute({ full_name: "User", email: `x${index}@test.com`, role })
        ).rejects.toMatchObject({ status: 400 });
      }
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
        role: "ADMIN",
      });
      expect(updated.role).toBe(UserRole.ADMIN);

      await expect(
        updateUseCase.execute(created.id, {
          role: "INVALID_ROLE",
        })
      ).rejects.toThrow("Rol de usuario no válido. Debe ser ADMIN o LOGISTICS.");
    });
  });

  describe("NC 10 - Email failure handling", () => {
    it("reports a 502 to the administrator and keeps the created user when email sending fails", async () => {
      emailService.sendCredentials = vi.fn().mockRejectedValue(new Error("SMTP server down"));
      const useCase = new CreateUserUseCase({ userRepository, emailService });

      const promise = useCase.execute({
        full_name: "Failing Email",
        email: "fail@test.com",
        role: "LOGISTICS",
      });
      await expect(promise).rejects.toBeInstanceOf(CredentialsDeliveryException);
      await expect(promise).rejects.toMatchObject({ status: 502 });

      expect(await userRepository.findByEmail("fail@test.com")).not.toBeNull();
    });

    it("fails explicitly when no email service is configured", async () => {
      const useCase = new CreateUserUseCase({ userRepository });
      await expect(
        useCase.execute({ full_name: "No Mail", email: "nomail@test.com", role: "ADMIN" })
      ).rejects.toBeInstanceOf(CredentialsDeliveryException);
    });
  });

  describe("NC 10 - Reenviar credenciales (RF-1.2.12.3)", () => {
    let resend;
    let pendingUser;

    beforeEach(async () => {
      const create = new CreateUserUseCase({ userRepository, emailService });
      pendingUser = await create.execute({
        full_name: "Pendiente",
        email: "pendiente@test.com",
        role: "LOGISTICS",
      });
      emailService.sendCredentials.mockClear();
      resend = new ResendUserCredentialsUseCase({ userRepository, emailService });
    });

    it("genera una nueva contraseña, invalida la anterior y la envía por correo", async () => {
      const before = (await userRepository.findById(pendingUser.id)).password_hash;
      await resend.execute(pendingUser.id);
      const after = await userRepository.findById(pendingUser.id);
      expect(after.password_hash).not.toBe(before);
      expect(after.must_change_password).toBe(true);
      expect(emailService.sendCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ to: "pendiente@test.com" })
      );
    });

    it("responde 404 si el usuario no existe", async () => {
      await expect(resend.execute(999)).rejects.toMatchObject({ status: 404 });
    });

    it("responde 409 si el usuario está inactivo o ya definió su contraseña", async () => {
      await userRepository.updateStatus(pendingUser.id, UserStatus.INACTIVE);
      await expect(resend.execute(pendingUser.id)).rejects.toMatchObject({ status: 409 });

      await userRepository.updateStatus(pendingUser.id, UserStatus.ACTIVE);
      await userRepository.update(pendingUser.id, { must_change_password: false });
      await expect(resend.execute(pendingUser.id)).rejects.toMatchObject({ status: 409 });
      expect(emailService.sendCredentials).not.toHaveBeenCalled();
    });

    it("informa si el reenvío vuelve a fallar", async () => {
      emailService.sendCredentials.mockRejectedValue(new Error("SMTP down"));
      await expect(resend.execute(pendingUser.id)).rejects.toBeInstanceOf(
        CredentialsDeliveryException
      );
    });
  });

  describe("NC 11 - Active reservation request status checking with Enum", () => {
    it("UserResponsibilityReservationRequestStatuses includes required active statuses from RF-1.2.12.10", () => {
      expect(UserResponsibilityReservationRequestStatuses).toContain(
        ReservationRequestStatus.ASSIGNED
      );
      expect(UserResponsibilityReservationRequestStatuses).toContain(
        ReservationRequestStatus.COORDINATION_READY
      );
      expect(UserResponsibilityReservationRequestStatuses).toContain(
        ReservationRequestStatus.COORDINATION_INCOMPLETE
      );
      expect(UserResponsibilityReservationRequestStatuses).toContain(
        ReservationRequestStatus.PROPOSAL_GENERATED
      );
      expect(UserResponsibilityReservationRequestStatuses).toContain(
        ReservationRequestStatus.CONFIRMED
      );
    });

    it("hasActiveRequests queries with the enum statuses", async () => {
      const pool = { query: vi.fn().mockResolvedValue({ rows: [{ total: "1" }] }) };
      const repository = new UserRepositoryImpl({ pool });
      await expect(repository.hasActiveRequests(3)).resolves.toBe(true);
      expect(pool.query.mock.calls[0][1][1]).toEqual([
        ...UserResponsibilityReservationRequestStatuses,
      ]);
    });

    it("only holds values taken from the ReservationRequestStatus enum", () => {
      const enumValues = Object.values(ReservationRequestStatus);
      UserResponsibilityReservationRequestStatuses.forEach((status) => {
        expect(enumValues).toContain(status);
      });
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
    it("generates employee_id matching the DAD format (3-digit string 100-999)", async () => {
      const empId = await generateUniqueEmployeeId(userRepository);
      expect(empId).toMatch(/^\d{3}$/);
      const num = parseInt(empId, 10);
      expect(num).toBeGreaterThanOrEqual(100);
      expect(num).toBeLessThanOrEqual(999);
    });

    it("includes the upper bound 999 and retries when the id already exists", async () => {
      const repository = { existsByEmployeeId: vi.fn() };
      repository.existsByEmployeeId.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const randomInt = vi.fn().mockReturnValueOnce(111).mockReturnValueOnce(999);
      await expect(generateUniqueEmployeeId(repository, randomInt)).resolves.toBe("999");
      expect(randomInt).toHaveBeenLastCalledWith(100, 1000);
    });

    it("fails after exhausting the attempts", async () => {
      const repository = { existsByEmployeeId: vi.fn().mockResolvedValue(true) };
      await expect(generateUniqueEmployeeId(repository, () => 123)).rejects.toThrow();
      expect(repository.existsByEmployeeId).toHaveBeenCalledTimes(10);
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
