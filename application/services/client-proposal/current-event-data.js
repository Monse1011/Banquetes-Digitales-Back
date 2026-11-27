// DAD Incremento 3 §3 "Datos vigentes del evento": event_date, start_time, end_time,
// event_address y guest_count provienen siempre de la misma fila: el derived_information
// más reciente (mayor created_at, desempate por mayor id) o, si no hay acuerdos, la
// solicitud. Nunca se combinan valores de filas distintas.
function pickLatestInformation(informations) {
  if (!Array.isArray(informations) || informations.length === 0) {
    return null;
  }

  return informations.reduce((latest, candidate) => {
    const latestTime = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
    const candidateTime = candidate.createdAt ? new Date(candidate.createdAt).getTime() : 0;

    if (candidateTime > latestTime) return candidate;
    if (candidateTime === latestTime && Number(candidate.id) > Number(latest.id)) {
      return candidate;
    }

    return latest;
  }, informations[0]);
}

function resolveCurrentEventData(request, information) {
  if (!information) {
    return {
      eventDate: request.eventDateTime,
      startDatetime: request.eventDateTime,
      endDatetime: request.eventEndTime,
      eventAddress: request.eventAddress,
      guestCount: request.guestCount,
    };
  }

  return {
    eventDate: information.startDatetime,
    startDatetime: information.startDatetime,
    endDatetime: information.endDatetime,
    eventAddress: information.location ?? request.eventAddress,
    guestCount: information.guestCount ?? request.guestCount,
  };
}

module.exports = { pickLatestInformation, resolveCurrentEventData };
