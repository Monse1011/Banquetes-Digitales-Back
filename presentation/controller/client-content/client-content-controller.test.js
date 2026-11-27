/* global vi */
const { ClientContentController } = require("./client-content-controller");
const { AdminRequestMessages } = require("../../../domain/constants/admin-request-messages");

describe.each(["services", "promotions", "gallery"])("paginación pública: %s", (method) => {
  let controller;
  let response;
  const items = Array.from({ length: 23 }, (_, index) => ({ id: index + 1 }));

  beforeEach(() => {
    controller = new ClientContentController({
      serviceRepository: { findActiveForPortal: vi.fn().mockResolvedValue(items) },
      promotionRepository: {
        expireOutdated: vi.fn().mockResolvedValue(),
        listActiveForPortal: vi.fn().mockResolvedValue(items),
      },
      galleryRepository: { listOrdered: vi.fn().mockResolvedValue(items) },
    });
    response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  it.each([
    [{}, 1, 10, items.slice(0, 10)],
    [{ page: "2" }, 2, 10, items.slice(10, 20)],
    [{ page: "3" }, 3, 10, items.slice(20)],
    [{ page: "4" }, 4, 10, []],
    [{ per_page: "5" }, 1, 5, items.slice(0, 5)],
    [{ page: "2", per_page: "5" }, 2, 5, items.slice(5, 10)],
    [{ page: "", per_page: "" }, 1, 10, items.slice(0, 10)],
  ])("aplica los valores de paginación de %j", async (query, page, perPage, expected) => {
    await controller[method]({ query }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: { [method]: expected },
      metadata: { pagination: { total_records: 23, page, per_page: perPage } },
    });
  });

  it.each([{ page: "0" }, { page: "1.5" }, { per_page: "0" }, { per_page: "101" }])(
    "rechaza paginación inválida: %j",
    async (query) => {
      await expect(controller[method]({ query }, response)).rejects.toMatchObject({
        status: 400,
        message: AdminRequestMessages.PAGINATION_INVALID,
      });
      expect(response.json).not.toHaveBeenCalled();
    }
  );

  it("mantiene los valores por defecto cuando no hay resultados", async () => {
    controller.serviceRepository.findActiveForPortal.mockResolvedValue([]);
    controller.promotionRepository.listActiveForPortal.mockResolvedValue([]);
    controller.galleryRepository.listOrdered.mockResolvedValue([]);

    await controller[method]({ query: {} }, response);

    expect(response.json).toHaveBeenCalledWith({
      data: { [method]: [] },
      metadata: { pagination: { total_records: 0, page: 1, per_page: 10 } },
    });
  });
});
