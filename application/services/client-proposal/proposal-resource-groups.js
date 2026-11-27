const { ResourceType } = require("../../../domain/enums/resource/resource-type");

// DAD Incremento 3, RF-3.4.4.3: desglose de recursos de la propuesta vigente.
// - Solo líneas con quantity > 0.
// - Humanos agrupados por rol operativo y costo unitario; description = nombre del rol,
//   quantity = número de personas. Nunca se exponen nombres del personal.
// - Materiales y logísticos: una entrada por recurso con description = resources.name.
// - unit_cost es el costo congelado de la línea; subtotal = quantity × unit_cost.
// Recibe líneas crudas: { type, description, quantity, unitCost }.
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function groupHuman(lines) {
  const grouped = new Map();

  for (const line of lines) {
    const key = `${line.description}__${line.unitCost}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += Number(line.quantity);
    } else {
      grouped.set(key, {
        description: line.description,
        quantity: Number(line.quantity),
        unit_cost: round2(line.unitCost),
      });
    }
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    subtotal: round2(entry.quantity * entry.unit_cost),
  }));
}

function mapSingleLines(lines) {
  return lines
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unit_cost: round2(line.unitCost),
      subtotal: round2(Number(line.quantity) * Number(line.unitCost)),
    }));
}

function groupProposalResources(lines = []) {
  const active = lines.filter((line) => Number(line.quantity) > 0);
  const human = active.filter((line) => line.type === ResourceType.HUMAN);
  const material = active.filter((line) => line.type === ResourceType.MATERIAL);
  const logistic = active.filter((line) => line.type === ResourceType.LOGISTIC);

  return {
    human: groupHuman(human),
    material: mapSingleLines(material),
    logistic: mapSingleLines(logistic),
  };
}

module.exports = { groupProposalResources };
