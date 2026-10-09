// Función 3.3: estado de la asignación de un recurso a una solicitud. «Liberada» es el
// estado que exige el ERS al cancelar; «Asignada» es la asignación vigente.
// SUPUESTO: el nombre «Asignada» no está definido en el ERS disponible; centralizado aquí
// para ajustarlo en un solo lugar cuando se confirme contra las Funciones 3.1/3.2.
const ResourceAssignmentStatus = Object.freeze({
  ASSIGNED: "Asignada",
  RELEASED: "Liberada",
});

module.exports = { ResourceAssignmentStatus };
