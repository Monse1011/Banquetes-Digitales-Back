const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const UserRepositoryImpl = require("./user-repository-impl");
const AuthRepository = require("../auth/postgres-user-repository");
const CreateUserUseCase = require("../../../application/use-cases/user/create-user-use-case");
const GetUserByIdUseCase = require("../../../application/use-cases/user/get-user-by-id-use-case");

describe.skipIf(!process.env.TEST_PGDATABASE)("User management with PostgreSQL", () => {
  it("creates a logistics user visible to authentication and assignment, without sending email", async () => {
    const pool = new Pool({ database: process.env.TEST_PGDATABASE });
    const connection = await pool.connect();
    await connection.query("BEGIN");
    try {
      const repository = new UserRepositoryImpl({ pool: connection });
      let credentials;
      const create = new CreateUserUseCase({
        userRepository: repository,
        emailService: {
          sendCredentials: async (value) => {
            credentials = value;
          },
        },
      });
      const user = await create.execute({
        full_name: "Prueba Logistica",
        email: `user-test-${Date.now()}@example.invalid`,
        role: "LOGISTICS",
      });
      const auth = new AuthRepository(connection);
      const loginUser = await auth.findByEmployeeId(user.employee_id);
      expect(loginUser.isActive()).toBe(true);
      expect(loginUser.isFirstAccess()).toBe(true);
      expect(await bcrypt.compare(credentials.tempPassword, loginUser.passwordHash)).toBe(true);
      expect((await auth.findActiveByRole("LOGISTICS")).some((u) => u.id === user.id)).toBe(true);
      expect((await repository.findAll({})).users.some((u) => u.id === user.id)).toBe(true);
      const detail = await new GetUserByIdUseCase({ userRepository: repository }).execute(user.id);
      expect(detail.assigned_requests).toEqual([]);
      await repository.update(user.id, { full_name: "Nombre Actualizado" });
      expect((await repository.findById(user.id)).full_name).toBe("Nombre Actualizado");
      await repository.updateStatus(user.id, "INACTIVE");
      expect((await auth.findById(user.id)).isActive()).toBe(false);
      await repository.updateCredentials(user.id, {
        password_hash: loginUser.passwordHash,
        must_change_password: true,
      });
      expect(await repository.hasActiveRequests(user.id)).toBe(false);
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
      await pool.end();
    }
  });
});
