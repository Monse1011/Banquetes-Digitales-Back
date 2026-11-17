const ServiceRequestDto = require("./service-request-dto");
const ServiceValidationException = require("../../../domain/exceptions/service/service-validation-exception");
const { ServiceMessages } = require("../../../domain/constants/service-messages");

describe("ServiceRequestDto (Función 2.6)", () => {
  it("validates and trims valid service data", () => {
    const dto = new ServiceRequestDto({
      name: "  Banquete Mexicano  ",
      description: "  Comida tradicional para eventos  ",
      price: 1500.5,
    });

    const validated = dto.validate();

    expect(validated).toEqual({
      name: "Banquete Mexicano",
      description: "Comida tradicional para eventos",
      price: 1500.5,
    });
  });

  it("rejects missing or empty name (RF-1.2.6.3.1)", () => {
    const dto = new ServiceRequestDto({
      name: "   ",
      description: "Descripción válida",
      price: 100,
    });

    expect(() => dto.validate()).toThrow(ServiceValidationException);
    try {
      dto.validate();
    } catch (error) {
      expect(error.errors.name).toBe(ServiceMessages.NAME_REQUIRED);
    }
  });

  it("rejects name longer than 100 characters (RF-1.2.6.3.1)", () => {
    const dto = new ServiceRequestDto({
      name: "A".repeat(101),
      description: "Descripción válida",
      price: 100,
    });

    expect(() => dto.validate()).toThrow(ServiceValidationException);
    try {
      dto.validate();
    } catch (error) {
      expect(error.errors.name).toBe(ServiceMessages.NAME_TOO_LONG);
    }
  });

  it("rejects missing or empty description (RF-1.2.6.3.1)", () => {
    const dto = new ServiceRequestDto({
      name: "Servicio válido",
      description: "   ",
      price: 100,
    });

    expect(() => dto.validate()).toThrow(ServiceValidationException);
    try {
      dto.validate();
    } catch (error) {
      expect(error.errors.description).toBe(ServiceMessages.DESCRIPTION_REQUIRED);
    }
  });

  it("rejects description longer than 300 characters (RF-1.2.6.3.1)", () => {
    const dto = new ServiceRequestDto({
      name: "Servicio válido",
      description: "B".repeat(301),
      price: 100,
    });

    expect(() => dto.validate()).toThrow(ServiceValidationException);
    try {
      dto.validate();
    } catch (error) {
      expect(error.errors.description).toBe(ServiceMessages.DESCRIPTION_TOO_LONG);
    }
  });

  it("rejects invalid price values (RF-1.2.6.3.1)", () => {
    const invalidPrices = [0, -10, NaN, "no-numeric", null, undefined, 10.999];

    invalidPrices.forEach((invalidPrice) => {
      const dto = new ServiceRequestDto({
        name: "Servicio válido",
        description: "Descripción válida",
        price: invalidPrice,
      });

      expect(() => dto.validate()).toThrow(ServiceValidationException);
      try {
        dto.validate();
      } catch (error) {
        expect(error.errors.price).toBe(ServiceMessages.PRICE_INVALID);
      }
    });
  });

  it("accepts valid price with up to 2 decimal places", () => {
    const validPrices = [0.01, 100, 250.5, 9999.99];

    validPrices.forEach((validPrice) => {
      const dto = new ServiceRequestDto({
        name: "Servicio válido",
        description: "Descripción válida",
        price: validPrice,
      });

      expect(dto.validate().price).toBe(validPrice);
    });
  });
});

