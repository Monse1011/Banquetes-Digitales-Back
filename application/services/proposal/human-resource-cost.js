const MS_PER_MINUTE = 60 * 1000;

// Defecto 4: costo de una persona = horas del evento × tarifa por hora, prorrateado por
// minutos (90 min = 1.5 h; sin redondear las horas hacia arriba). Funciona si el evento cruza
// la medianoche porque solo usa la diferencia de instantes. Solo se redondea el resultado a
// centavos. precio null (fila anterior a la columna) cuesta 0.
function humanResourceCost(precio, startAt, endAt) {
  if (precio === null || precio === undefined) return 0;

  const minutes = (endAt.getTime() - startAt.getTime()) / MS_PER_MINUTE;

  return Math.round((Number(precio) * 100 * minutes) / 60) / 100;
}

module.exports = { humanResourceCost };
