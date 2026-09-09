const Email = require("../../domain/value-objects/email");

// RF-3.4.3.2: solo letras (con acentos) y al menos nombre + apellido.
const FULL_NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s[A-Za-zÀ-ÖØ-öø-ÿ]+)+$/;

// RF-3.4.3.2: solo dígitos, 10 caracteres.
const PHONE_REGEX = /^\d{10}$/;

function isPastCalendarDate(dateValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDate = new Date(dateValue);
  eventDate.setHours(0, 0, 0, 0);

  return eventDate < today;
}

function validateFullName(dto) {
  const value = typeof dto.client_full_name === "string" ? dto.client_full_name.trim() : "";

  if (!FULL_NAME_REGEX.test(value)) {
    return "Por favor, ingrese su nombre y apellido. No se permiten números ni símbolos.";
  }

  return undefined;
}

function validateEmail(dto) {
  if (!dto.email || !Email.isValid(dto.email)) {
    return "Ingrese una dirección de correo válida. Ejemplo: nombre@dominio.com";
  }

  return undefined;
}

function validatePhone(dto) {
  if (!dto.phone || !PHONE_REGEX.test(dto.phone)) {
    return "El número debe contener solo dígitos y tener 10 caracteres.";
  }

  return undefined;
}

function validateEventDateTime(dto) {
  const parsedDate = dto.event_date_time ? new Date(dto.event_date_time) : null;
  const isInvalidDate = !parsedDate || Number.isNaN(parsedDate.getTime());

  if (isInvalidDate || isPastCalendarDate(parsedDate)) {
    return "Seleccione una fecha válida. No puede ser anterior a la fecha actual.";
  }

  return undefined;
}

function validateGuestCount(dto) {
  if (!Number.isInteger(dto.guest_count) || dto.guest_count <= 0) {
    return "Ingrese un número entero mayor a cero.";
  }

  return undefined;
}

function validateEventAddress(dto) {
  const value = typeof dto.event_address === "string" ? dto.event_address.trim() : "";

  if (!value) {
    return "La dirección del evento es obligatoria.";
  }

  return undefined;
}

function validateServicesIds(dto) {
  if (!Array.isArray(dto.services_ids) || dto.services_ids.length === 0) {
    return "Debe seleccionar al menos un servicio para continuar.";
  }

  return undefined;
}

function validateCreateReservationRequest(dto) {
  const safeDto = dto || {};

  const fieldValidations = {
    client_full_name: validateFullName(safeDto),
    email: validateEmail(safeDto),
    phone: validatePhone(safeDto),
    event_date_time: validateEventDateTime(safeDto),
    guest_count: validateGuestCount(safeDto),
    event_address: validateEventAddress(safeDto),
    services_ids: validateServicesIds(safeDto),
  };

  return Object.fromEntries(
    Object.entries(fieldValidations).filter(([, message]) => message !== undefined)
  );
}

module.exports = { validateCreateReservationRequest };
