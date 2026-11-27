const UserRepositoryImpl = require("../infrastructure/repositories/user/user-repository-impl");
const ListUsersUseCase = require("../application/use-cases/user/list-users-use-case");
const GetUserByIdUseCase = require("../application/use-cases/user/get-user-by-id-use-case");
const CreateUserUseCase = require("../application/use-cases/user/create-user-use-case");
const UpdateUserUseCase = require("../application/use-cases/user/update-user-use-case");
const ToggleUserStatusUseCase = require("../application/use-cases/user/toggle-user-status-use-case");
const ResendUserCredentialsUseCase = require("../application/use-cases/user/resend-user-credentials-use-case");

// Función 2.12: casos de uso de gestión de usuarios (RF-1.2.12.1 a RF-1.2.12.16).
function createUserManagementUseCases({ pool, emailService }) {
  const userRepository = new UserRepositoryImpl({ pool });
  return {
    listUsersUseCase: new ListUsersUseCase({ userRepository }),
    getUserByIdUseCase: new GetUserByIdUseCase({ userRepository }),
    createUserUseCase: new CreateUserUseCase({ userRepository, emailService }),
    updateUserUseCase: new UpdateUserUseCase({ userRepository }),
    toggleUserStatusUseCase: new ToggleUserStatusUseCase({ userRepository }),
    resendUserCredentialsUseCase: new ResendUserCredentialsUseCase({
      userRepository,
      emailService,
    }),
  };
}

module.exports = createUserManagementUseCases;
