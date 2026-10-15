// Fallo al comunicarse con Google Calendar. `code` distingue la causa para el registro:
// NOT_CONFIGURED | AUTH | TIMEOUT | NETWORK | HTTP_ERROR | INVALID_RESPONSE.
class GoogleCalendarSyncException extends Error {
  constructor(code, message, { status = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "GoogleCalendarSyncException";
    this.code = code;
    this.status = status;
  }
}

module.exports = GoogleCalendarSyncException;
