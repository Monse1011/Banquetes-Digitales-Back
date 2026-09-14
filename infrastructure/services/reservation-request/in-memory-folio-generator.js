class InMemoryFolioGenerator {
  constructor() {
    this.nextFolio = 1;
  }

  generate() {
    const year = new Date().getFullYear();
    const folio = `BD-${year}-${this.nextFolio.toString().padStart(5, "0")}`;

    this.nextFolio++;

    return folio;
  }
}

module.exports = { InMemoryFolioGenerator };
