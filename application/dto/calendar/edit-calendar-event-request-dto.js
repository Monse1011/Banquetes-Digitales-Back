const { CalendarMessages } = require("../../../domain/constants/calendar-messages");

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_PER_DAY = 86400000;

// F.1 / F.2: campos que no pueden cambiarse en un evento confirmado.
const IMMUTABLE_FIELDS = Object.freeze([
  "user_id",
  "logistic_user_id",
  "responsible_id",
  "resources",
  "resource_ids",
  "resources_ids",
  "assignments",
]);

function parseDate(value) {
  const match = typeof value === "string" ? DATE_REGEX.exec(value) : null;

  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isRealDate ? { year, month, day } : null;
}

function parseTime(value) {
  const match = typeof value === "string" ? TIME_REGEX.exec(value) : null;

  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

function localDateParts(date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function localTimeParts(date) {
  return { hours: date.getHours(), minutes: date.getMinutes() };
}

function daysBetween(from, to) {
  const left = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const right = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((right - left) / MS_PER_DAY);
}

// C.1: edición de fecha, hora y ubicación. La fecha y las horas se interpretan en la zona
// horaria del servidor, igual que el resto del proyecto (date-time-formatter).
class EditCalendarEventRequestDto {
  constructor(data = {}) {
    const source = data !== null && typeof data === "object" ? data : {};

    this.event_date = source.event_date;
    this.start_time = source.start_time;
    this.end_time = source.end_time;
    this.location = source.location;
    this.immutableFieldsSent = IMMUTABLE_FIELDS.filter((field) => source[field] !== undefined);
  }

  hasImmutableFields() {
    return this.immutableFieldsSent.length > 0;
  }

  hasAnyChange() {
    return [this.event_date, this.start_time, this.end_time, this.location].some(
      (value) => value !== undefined
    );
  }

  // Devuelve { errors, startAt, endAt, location } relativos al evento actual.
  resolve(event, now) {
    const errors = {};
    const date = this.resolveDate(event, errors);
    const startTime = this.resolveTime(this.start_time, localTimeParts(event.startAt), "start_time", errors);
    const endTime = this.resolveTime(this.end_time, localTimeParts(event.endAt), "end_time", errors);
    const location = this.resolveLocation(event, errors);

    if (Object.keys(errors).length > 0) {
      return { errors };
    }

    const offset = daysBetween(event.startAt, event.endAt);
    const startAt = new Date(date.year, date.month - 1, date.day, startTime.hours, startTime.minutes);
    const endAt = new Date(
      date.year,
      date.month - 1,
      date.day + offset,
      endTime.hours,
      endTime.minutes
    );

    if (endAt.getTime() <= startAt.getTime()) {
      errors.end_time = CalendarMessages.END_BEFORE_START;
    }

    const scheduleChanged =
      startAt.getTime() !== event.startAt.getTime() || endAt.getTime() !== event.endAt.getTime();

    if (scheduleChanged && startAt.getTime() <= now.getTime()) {
      errors.start_time = CalendarMessages.START_IN_PAST;
    }

    return { errors, startAt, endAt, location };
  }

  resolveDate(event, errors) {
    if (this.event_date === undefined) return localDateParts(event.startAt);

    const parsed = parseDate(this.event_date);

    if (!parsed) errors.event_date = CalendarMessages.INVALID_DATE;

    return parsed;
  }

  resolveTime(value, fallback, field, errors) {
    if (value === undefined) return fallback;

    const parsed = parseTime(value);

    if (!parsed) errors[field] = CalendarMessages.INVALID_TIME;

    return parsed;
  }

  resolveLocation(event, errors) {
    if (this.location === undefined) return event.location;

    const value = typeof this.location === "string" ? this.location.trim() : "";

    if (!value) errors.location = CalendarMessages.INVALID_LOCATION;

    return value;
  }
}

module.exports = { EditCalendarEventRequestDto, IMMUTABLE_FIELDS };
