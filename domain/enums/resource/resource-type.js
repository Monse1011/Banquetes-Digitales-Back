// Valores del enum ResourceType del contrato API (DAD, sección 3). En la base de datos se
// guardan en español; la traducción vive en el repositorio de Postgres.
const ResourceType = Object.freeze({
  HUMAN: "HUMAN",
  MATERIAL: "MATERIAL",
  LOGISTIC: "LOGISTIC",
});

module.exports = { ResourceType };
