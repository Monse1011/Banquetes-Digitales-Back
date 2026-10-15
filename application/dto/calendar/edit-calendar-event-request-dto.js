/* eslint-disable no-param-reassign */
const { CalendarMessages } = require("../../../domain/constants/calendar-messages");

const DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/;
const ZONED_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

// F.1 / F.2: campos que no pueden cambiarse en un evento confirmado.
const IMMUTABLE_FIELDS = Object.freeze(["logistic_user_id", "resources"]);
const EDITABLE_FIELDS = new Set(["start_datetime", "end_datetime", "location"]);
const IMMUTABLE_FIELD_SET = new Set(IMMUTABLE_FIELDS);

function isRealUtcDate(year, month, day) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseLocalDateTime(match) {
  const [year, month, day, hours, minutes, seconds = "0", milliseconds = "0"] = match
    .slice(1)
    .map((part) => part ?? "0");
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
    Number(milliseconds.padEnd(3, "0"))
  );
  const isRealDate =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hours) &&
    date.getMinutes() === Number(minutes) &&
    date.getSeconds() === Number(seconds);

  return isRealDate ? date : null;
}

function parseZonedDateTime(value) {
  const match = ZONED_DATE_TIME_REGEX.exec(value);

  if (!match) return null;

  const [, yearText, monthText, dayText, , , , offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const offsetMinutes = offset === "Z" ? 0 : Number(offset.slice(4, 6));
  const offsetHours = offset === "Z" ? 0 : Number(offset.slice(1, 3));

  if (!isRealUtcDate(year, month, day) || (offsetHours === 14 && offsetMinutes !== 0)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTime(value) {
  if (typeof value !== "string") return null;

  const localMatch = DATE_TIME_REGEX.exec(value);

  return localMatch ? parseLocalDateTime(localMatch) : parseZonedDateTime(value);
}

// C.1: edición de fecha, hora y ubicación. La fecha y las horas se interpretan en la zona
// horaria del servidor, igual que el resto del proyecto (date-time-formatter).
class EditCalendarEventRequestDto {
  constructor(data = {}) {
    const source = data !== null && typeof data === "object" ? data : {};

    this.start_datetime = source.start_datetime;
    this.end_datetime = source.end_datetime;
    this.location = source.location;
    this.immutableFieldsSent = IMMUTABLE_FIELDS.filter((field) => source[field] !== undefined);
    this.unsupportedFieldsSent = Object.keys(source).filter(
      (field) => !EDITABLE_FIELDS.has(field) && !IMMUTABLE_FIELD_SET.has(field)
    );
  }

  hasImmutableFields() {
    return this.immutableFieldsSent.length > 0;
  }

  hasAnyChange() {
    return [this.start_datetime, this.end_datetime, this.location].some(
      (value) => value !== undefined
    );
  }

  // Devuelve { errors, startAt, endAt, location } relativos al evento actual.
  resolve(event, now) {
    const errors = {};
    const startAt = this.resolveDateTime(
      this.start_datetime,
      event.startAt,
      "start_datetime",
      errors
    );
    const endAt = this.resolveDateTime(this.end_datetime, event.endAt, "end_datetime", errors);
    const location = this.resolveLocation(event, errors);

    if (Object.keys(errors).length > 0) {
      return { errors };
    }

    if (endAt.getTime() <= startAt.getTime()) {
      errors.end_datetime = CalendarMessages.END_BEFORE_START;
    }

    const scheduleChanged =
      startAt.getTime() !== event.startAt.getTime() || endAt.getTime() !== event.endAt.getTime();

    if (scheduleChanged && startAt.getTime() <= now.getTime()) {
      errors.start_datetime = CalendarMessages.START_IN_PAST;
    }

    return { errors, startAt, endAt, location };
  }

  resolveDateTime(value, fallback, field, errors) {
    if (value === undefined) return fallback;

    const parsed = parseDateTime(value);

    if (!parsed) errors[field] = CalendarMessages.INVALID_DATE_TIME;

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
