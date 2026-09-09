import { FolioGenerator } from "../../application/services/folio-generator";

export class InMemoryFolioGenerator implements FolioGenerator {
  private nextFolio = 1;

  generate(): string {
    const year = new Date().getFullYear();
    const folio = `BD-${year}-${this.nextFolio.toString().padStart(5, "0")}`;

    this.nextFolio++;

    return folio;
  }
}
