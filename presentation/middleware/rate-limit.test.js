/* global vi */
const createRateLimit = require("./rate-limit");

describe("rate limit middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes expired clients from the in-memory map", () => {
    const middleware = createRateLimit({
      windowMs: 1000,
      max: 1,
      message: "Too many requests",
    });
    const request = { ip: "client-1", socket: {} };
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    middleware(request, response, next);
    middleware(request, response, next);
    expect(response.status).toHaveBeenCalledWith(429);

    vi.advanceTimersByTime(1000);
    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
