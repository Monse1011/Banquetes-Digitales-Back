const Email = require("../../../domain/value-objects/email");

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

class CreateReservationRequestDto {
  constructor(
    clientFullName,
    email,
    phone,
    eventDateTime,
    guestCount,
    eventAddress,
    servicesIds
  ) {
    this.client_full_name = clientFullName;
    this.email = email;
    this.phone = phone;
    this.event_date_time = eventDateTime;
    this.guest_count = guestCount;
    this.event_address = eventAddress;
    this.services_ids = servicesIds;
  }

  validate() {
    const fieldValidations = {
      client_full_name: this.validateFullName(),
      email: this.validateEmail(),
      phone: this.validatePhone(),
      event_date_time: this.validateEventDateTime(),
      guest_count: this.validateGuestCount(),
      event_address: this.validateEventAddress(),
      services_ids: this.validateServicesIds(),
    };

    return Object.fromEntries(
      Object.entries(fieldValidations).filter(([, message]) => message !== undefined)
    );
  }

  validateFullName() {
    const value = typeof this.client_full_name === "string" ? this.client_full_name.trim() : "";

    if (!FULL_NAME_REGEX.test(value)) {
      return "Por favor, ingrese su nombre y apellido. No se permiten números ni símbolos.";
    }

    return undefined;
  }

  validateEmail() {
    if (!this.email || !new Email(this.email).isValid()) {
      return "Ingrese una dirección de correo válida. Ejemplo: nombre@dominio.com";
    }

    return undefined;
  }

  validatePhone() {
    if (!this.phone || !PHONE_REGEX.test(this.phone)) {
      return "El número debe contener solo dígitos y tener 10 caracteres.";
    }

    return undefined;
  }

  validateEventDateTime() {
    const parsedDate = this.event_date_time ? new Date(this.event_date_time) : null;
    const isInvalidDate = !parsedDate || Number.isNaN(parsedDate.getTime());

    if (isInvalidDate || isPastCalendarDate(parsedDate)) {
      return "Seleccione una fecha válida. No puede ser anterior a la fecha actual.";
    }

    return undefined;
  }

  validateGuestCount() {
    if (!Number.isInteger(this.guest_count) || this.guest_count <= 0) {
      return "Ingrese un número entero mayor a cero.";
    }

    return undefined;
  }

  validateEventAddress() {
    const value = typeof this.event_address === "string" ? this.event_address.trim() : "";

    if (!value) {
      return "La dirección del evento es obligatoria.";
    }

    return undefined;
  }

  validateServicesIds() {
    if (!Array.isArray(this.services_ids) || this.services_ids.length === 0) {
      return "Debe seleccionar al menos un servicio para continuar.";
    }

    return undefined;
  }
}

module.exports = CreateReservationRequestDto;
