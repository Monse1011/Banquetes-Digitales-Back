const {
  ReassignableReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const UserRole = require("../../../domain/enums/auth/user-role");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");
const RequestNotReassignableException = require("../../../domain/exceptions/reservation-request/request-not-reassignable-exception");
const RequestAssignmentConflictException = require("../../../domain/exceptions/reservation-request/request-assignment-conflict-exception");
const LogisticsUserNotAvailableException = require("../../../domain/exceptions/reservation-request/logistics-user-not-available-exception");
const {
  formatDate,
  formatTime,
} = require("../../services/reservation-request/date-time-formatter");

// Función 2.4 - Asignación y reasignación de eventos.
class AssignReservationRequestUseCase {
  constructor(reservationRequestRepository, userRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.userRepository = userRepository;
  }

  async execute(requestId, logisticUserId, assignedByUserId, currentLogisticUserId = null) {
    const request = await this.reservationRequestRepository.findById(requestId);

    if (!request) {
      throw new ReservationRequestNotFoundException();
    }

    if (!ReassignableReservationRequestStatuses.includes(request.status)) {
      throw new RequestNotReassignableException();
    }

    // RF-1.2.4.7: el responsable mostrado al administrador ya no coincide.
    if (currentLogisticUserId !== null && request.logisticUserId !== currentLogisticUserId) {
      throw new RequestAssignmentConflictException();
    }

    // El responsable debe ser un usuario Activo con rol Personal de Logística.
    const logisticUser = await this.userRepository.findById(logisticUserId);

    if (!logisticUser || !logisticUser.isActive() || logisticUser.role !== UserRole.LOGISTICA) {
      throw new LogisticsUserNotAvailableException();
    }

    const result = await this.reservationRequestRepository.assign(
      requestId,
      logisticUserId,
      assignedByUserId,
      currentLogisticUserId
    );

    return this.registerAssignmentResult(result);
  }

  registerAssignmentResult(result) {
    const outcomes = {
      assigned: () => result.request ?? null,
      assignment_conflict: () => {
        throw new RequestAssignmentConflictException();
      },
      not_reassignable: () => {
        throw new RequestNotReassignableException();
      },
      user_unavailable: () => {
        throw new LogisticsUserNotAvailableException();
      },
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
