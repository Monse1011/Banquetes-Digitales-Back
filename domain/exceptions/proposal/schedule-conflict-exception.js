const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.10: el horario confirmado traslapa la agenda del responsable.
class ScheduleConflictException extends Error {
  constructor(conflicts) {
    super(ProposalMessages.SCHEDULE_CONFLICT);
    this.name = "ScheduleConflictException";
    this.conflicts = conflicts;
  }
}

module.exports = ScheduleConflictException;
