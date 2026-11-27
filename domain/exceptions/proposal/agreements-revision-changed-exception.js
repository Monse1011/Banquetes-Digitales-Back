class AgreementsRevisionChangedException extends Error {
  constructor() {
    super(
      "Los acuerdos cambiaron desde que abriste esta pantalla. Actualiza los acuerdos y revisa los datos antes de continuar."
    );
    this.name = "AgreementsRevisionChangedException";
    this.code = "AGREEMENTS_REVISION_CHANGED";
  }
}

module.exports = AgreementsRevisionChangedException;
