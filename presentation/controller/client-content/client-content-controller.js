// Función 4.1: listados públicos (contratos 11 y 12 + galería y redes del diagrama
// Función 3.4). AD-11: la lista llega completa y metadata.pagination es informativo;
// page/per_page solo se honran si el cliente los envía explícitamente (contratos 11/12).
const { AdminRequestMessages } = require("../../../domain/constants/admin-request-messages");
const ValidationException = require("../../../domain/exceptions/validation-exception");

function parsePagination(query) {
  const rawPage = query.page === undefined || query.page === "" ? null : String(query.page);
  const rawPerPage =
    query.per_page === undefined || query.per_page === "" ? null : String(query.per_page);

  if (rawPage === null && rawPerPage === null) return null;

  const page = rawPage === null ? 1 : Number(rawPage);
  const perPage = rawPerPage === null ? null : Number(rawPerPage);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    (perPage !== null && (!Number.isInteger(perPage) || perPage < 1 || perPage > 100))
  ) {
    throw new ValidationException(AdminRequestMessages.PAGINATION_INVALID);
  }

  return { page, perPage };
}

function paginate(items, query) {
  const requested = parsePagination(query);

  if (!requested || requested.perPage === null) {
    return {
      items,
      pagination: { total_records: items.length, page: 1, per_page: items.length || 10 },
    };
  }

  const start = (requested.page - 1) * requested.perPage;

  return {
    items: items.slice(start, start + requested.perPage),
    pagination: { total_records: items.length, page: requested.page, per_page: requested.perPage },
  };
}

class ClientContentController {
  constructor({ serviceRepository, promotionRepository, galleryRepository, socialLinkRepository }) {
    this.serviceRepository = serviceRepository;
    this.promotionRepository = promotionRepository;
    this.galleryRepository = galleryRepository;
    this.socialLinkRepository = socialLinkRepository;
  }

  // Contrato 12: catálogo vigente con nombre, descripción y precio.
  async services(request, response) {
    const all = await this.serviceRepository.findActiveForPortal();
    const { items, pagination } = paginate(all, request.query);

    response.status(200).json({ data: { services: items }, metadata: { pagination } });
  }

  // Contrato 11: expira antes de listar (RF-1.2.7.7) y solo muestra vigentes.
  async promotions(request, response) {
    await this.promotionRepository.expireOutdated();
    const all = await this.promotionRepository.listActiveForPortal();
    const { items, pagination } = paginate(all, request.query);

    response.status(200).json({ data: { promotions: items }, metadata: { pagination } });
  }

  async gallery(request, response) {
    const all = await this.galleryRepository.listOrdered();
    const { items, pagination } = paginate(all, request.query);

    response.status(200).json({ data: { gallery: items }, metadata: { pagination } });
  }

  // RF-3.4.1.3: solo redes con enlace; conjunto acotado, sin paginación.
  async socialLinks(_request, response) {
    const socialLinks = await this.socialLinkRepository.listOrdered();

    response.status(200).json({ data: { social_links: socialLinks } });
  }
}

module.exports = { ClientContentController };
