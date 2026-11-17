const PromotionRequestDto = require("./promotion-request-dto");
const PromotionValidationException = require("../../../domain/exceptions/promotion/promotion-validation-exception");
const { PromotionMessages } = require("../../../domain/constants/promotion-messages");

describe("PromotionRequestDto (Función 2.7)", () => {
  const currentDate = "2026-11-04";

  it("validates and trims valid promotion data", () => {
    const dto = new PromotionRequestDto({
      name: "  Descuento de temporada  ",
      description: "  Aplica en eventos de temporada  ",
      discount_percentage: 10.5,
      valid_until: "2026-12-31",
    });

    const validated = dto.validate(currentDate);

    expect(validated).toEqual({
      name: "Descuento de temporada",
      description: "Aplica en eventos de temporada",
      discount_percentage: 10.5,
      valid_until: "2026-12-31",
    });
  });

  it("rejects missing or empty name (RF-1.2.7.3.1)", () => {
    const dto = new PromotionRequestDto({
      name: "   ",
      description: "Descripción válida",
      discount_percentage: 10,
      valid_until: "2026-12-31",
    });

    expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
    try {
      dto.validate(currentDate);
    } catch (error) {
      expect(error.errors.name).toBe(PromotionMessages.NAME_REQUIRED);
    }
  });

  it("rejects name longer than 100 characters (RF-1.2.7.3.1)", () => {
    const dto = new PromotionRequestDto({
      name: "A".repeat(101),
      description: "Descripción válida",
      discount_percentage: 10,
      valid_until: "2026-12-31",
    });

    expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
    try {
      dto.validate(currentDate);
    } catch (error) {
      expect(error.errors.name).toBe(PromotionMessages.NAME_TOO_LONG);
    }
  });

  it("rejects missing or empty description (RF-1.2.7.3.1)", () => {
    const dto = new PromotionRequestDto({
      name: "Promoción válida",
      description: "   ",
      discount_percentage: 10,
      valid_until: "2026-12-31",
    });

    expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
    try {
      dto.validate(currentDate);
    } catch (error) {
      expect(error.errors.description).toBe(PromotionMessages.DESCRIPTION_REQUIRED);
    }
  });

  it("rejects description longer than 300 characters (RF-1.2.7.3.1)", () => {
    const dto = new PromotionRequestDto({
      name: "Promoción válida",
      description: "B".repeat(301),
      discount_percentage: 10,
      valid_until: "2026-12-31",
    });

    expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
    try {
      dto.validate(currentDate);
    } catch (error) {
      expect(error.errors.description).toBe(PromotionMessages.DESCRIPTION_TOO_LONG);
    }
  });

  it("rejects invalid discount percentage values (RF-1.2.7.3.1)", () => {
    const invalidDiscounts = [0, -5, 100.01, 150, NaN, "no-numeric", null, undefined, 10.999];

    invalidDiscounts.forEach((invalidDiscount) => {
      const dto = new PromotionRequestDto({
        name: "Promoción válida",
        description: "Descripción válida",
        discount_percentage: invalidDiscount,
        valid_until: "2026-12-31",
      });

      expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
      try {
        dto.validate(currentDate);
      } catch (error) {
        expect(error.errors.discount_percentage).toBe(PromotionMessages.DISCOUNT_INVALID);
      }
    });
  });

  it("accepts valid discount with up to 2 decimal places and up to 100", () => {
    const validDiscounts = [0.01, 5, 12.5, 99.99, 100];

    validDiscounts.forEach((validDiscount) => {
      const dto = new PromotionRequestDto({
        name: "Promoción válida",
        description: "Descripción válida",
        discount_percentage: validDiscount,
        valid_until: "2026-12-31",
      });

      expect(dto.validate(currentDate).discount_percentage).toBe(validDiscount);
    });
  });

  it("rejects missing or invalid valid_until format (RF-1.2.7.3.1)", () => {
    const invalidDates = ["", "   ", "2026/12/31", "31-12-2026", "2026-02-31", "invalid"];

    invalidDates.forEach((invalidDate) => {
      const dto = new PromotionRequestDto({
        name: "Promoción válida",
        description: "Descripción válida",
        discount_percentage: 10,
        valid_until: invalidDate,
      });

      expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
    });
  });

  it("rejects valid_until earlier than current date (RF-1.2.7.3.1)", () => {
    const dto = new PromotionRequestDto({
      name: "Promoción válida",
      description: "Descripción válida",
      discount_percentage: 10,
      valid_until: "2026-11-03",
    });

    expect(() => dto.validate(currentDate)).toThrow(PromotionValidationException);
    try {
      dto.validate(currentDate);
    } catch (error) {
      expect(error.errors.valid_until).toBe(PromotionMessages.VALID_UNTIL_PAST);
    }
  });

  it("accepts valid_until equal to current date (inclusive RF-1.2.7.3)", () => {
    const dto = new PromotionRequestDto({
      name: "Promoción válida",
      description: "Descripción válida",
      discount_percentage: 10,
      valid_until: currentDate,
    });

    expect(dto.validate(currentDate).valid_until).toBe(currentDate);
  });
});

