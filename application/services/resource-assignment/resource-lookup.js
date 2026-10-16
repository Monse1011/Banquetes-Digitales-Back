// Obtiene los recursos en una sola consulta y los devuelve en el orden de ids (null si alguno no
// existe), para no consultar uno por uno.
async function findResourcesInOrder(resourceRepository, ids) {
  const resources = await resourceRepository.findByIds([...new Set(ids)]);
  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  return ids.map((id) => byId.get(id) ?? null);
}

module.exports = { findResourcesInOrder };
