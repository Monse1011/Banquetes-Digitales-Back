const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const UserRole = require("../../../domain/enums/auth/user-role");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");
const RequestNotApprovedException = require("../../../domain/exceptions/reservation-request/request-not-approved-exception");
const RequestAlreadyAssignedException = require("../../../domain/exceptions/reservation-request/request-already-assigned-exception");
const RequestAssignmentConflictException = require("../../../domain/exceptions/reservation-request/request-assignment-conflict-exception");
const LogisticsUserNotAvailableException = require("../../../domain/exceptions/reservation-request/logistics-user-not-available-exception");
const {
  formatDate,
  formatTime,
} = require("../../services/reservation-request/date-time-formatter");

// Función 2.4 - Asignación de eventos (RF-1.2.4.1 a RF-1.2.4.7, RF-1.2.4.14)
class AssignReservationRequestUseCase {
  constructor(reservationRequestRepository, userRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.userRepository = userRepository;
  }

  async execute(requestId, logisticUserId, assignedByUserId) {
    const request = await this.reservationRequestRepository.findById(requestId);

    if (!request) {
      throw new ReservationRequestNotFoundException();
    }

    // RF-1.2.4.6: una solicitud con responsable no puede reasignarse.
    if (request.logisticUserId !== null) {
      throw new RequestAlreadyAssignedException();
    }

    // RF-1.2.4.1 / RF-1.2.4.17: solo solicitudes "Aprobada".
    if (request.status !== ReservationRequestStatus.APPROVED) {
      throw new RequestNotApprovedException();
    }

    // RF-1.2.4.1: el responsable debe ser un usuario Activo con rol Personal de Logística.
    const logisticUser = await this.userRepository.findById(logisticUserId);

    if (!logisticUser || !logisticUser.isActive() || logisticUser.role !== UserRole.LOGISTICA) {
      throw new LogisticsUserNotAvailableException();
    }

    // RF-1.2.4.7: la asignación se registra de forma atómica en el repositorio.
    const result = await this.reservationRequestRepository.assign(
      requestId,
      logisticUserId,
      assignedByUserId
    );

    return this.registerAssignmentResult(result);
  }

  registerAssignmentResult(result) {
    const outcomes = {
      assigned: () => result.request ?? null,
      already_assigned: () => {
        throw new RequestAssignmentConflictException();
      },
      not_approved: () => {
        throw new RequestNotApprovedException();
      },
      user_unavailable: () => {
        throw new LogisticsUserNotAvailableException();
      },
      // RF-1.2.4.4 / RF-1.2.4.5: traslape con otra solicitud activa del empleado.
      overlap: () => {
        throw new LogisticsUserNotAvailableException(this.toConflict(result.conflicts[0]));
      },
    };

    const outcome = outcomes[result.status];

    if (!outcome) {
      throw new Error(`Unexpected assignment result: ${result.status}`);
    }

    return outcome();
  }

  toConflict(conflict) {
    if (!conflict) {
      return null;
    }

    return {
      folio: conflict.folio,
      event_date: formatDate(conflict.startDateTime),
      start_time: formatTime(conflict.startDateTime),
      end_time: formatTime(conflict.endDateTime),
    };
  }
}

module.exports = { AssignReservationRequestUseCase };
