const { AdjustmentsRequestDto } = require("./adjustments-request-dto");
const ObservationsValidationException = require("../../../domain/exceptions/client-proposal/observations-validation-exception");
const { ClientProposalMessages } = require("../../../domain/constants/client-proposal-messages");

const OBSERVATIONS_MAX_LENGTH = 500;

function repeatUnicode(character, times) {
  return Array.from({ length: times }, () => character).join("");
}

describe("AdjustmentsRequestDto - límite de 500 caracteres (NC-06)", () => {
  it("acepta 500 caracteres ASCII", () => {
    const dto = new AdjustmentsRequestDto({ observations: "a".repeat(OBSERVATIONS_MAX_LENGTH) });

    expect(dto.validate()).toHaveLength(OBSERVATIONS_MAX_LENGTH);
  });

  it("rechaza 501 caracteres", () => {
    const dto = new AdjustmentsRequestDto({
      observations: "a".repeat(OBSERVATIONS_MAX_LENGTH + 1),
    });

    expect(() => dto.validate()).toThrowError(
      new ObservationsValidationException(ClientProposalMessages.OBSERVATIONS_TOO_LONG)
    );
  });

  it("rechaza observaciones vacías", () => {
    const dto = new AdjustmentsRequestDto({ observations: "   " });

    expect(() => dto.validate()).toThrowError(
      new ObservationsValidationException(ClientProposalMessages.OBSERVATIONS_REQUIRED)
    );
  });

  // NC-06: el DTO debe contar puntos de código Unicode, igual que char_length de
  // PostgreSQL. 250 emojis son 500 unidades UTF-16 pero 250 caracteres; 500 emojis son
  // 1000 unidades UTF-16 y solo 500 caracteres, y deben ser aceptados.
  it("acepta 500 emojis (1000 unidades UTF-16, 500 para char_length)", () => {
    const dto = new AdjustmentsRequestDto({
      observations: repeatUnicode("🎉", OBSERVATIONS_MAX_LENGTH),
    });

    expect(dto.validate()).toBe(repeatUnicode("🎉", OBSERVATIONS_MAX_LENGTH));
  });

  it("rechaza 501 emojis", () => {
    const dto = new AdjustmentsRequestDto({
      observations: repeatUnicode("🎉", OBSERVATIONS_MAX_LENGTH + 1),
    });

    expect(() => dto.validate()).toThrowError(
      new ObservationsValidationException(ClientProposalMessages.OBSERVATIONS_TOO_LONG)
    );
  });

  it("cuenta igual que char_length: mixturas acentos, ñ y caracteres suplementarios", () => {
    const value = repeatUnicode("áñ💍é", 100); // 400 puntos de código (800 unidades UTF-16)

    const dto = new AdjustmentsRequestDto({ observations: value });

    expect(Array.from(value)).toHaveLength(400);
    expect(dto.validate()).toBe(value);
  });
});
