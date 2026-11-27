const {
  buildBuckets,
  enumerateIntervals,
  inclusiveDayCount,
  isSingleDayPeriod,
  monthLabel,
  resolveGranularity,
  resolvePeriodRange,
  resolveTimeChart,
} = require("./report-period");

describe("resolvePeriodRange", () => {
  it("DAY y RANGE usan las fechas tal cual", () => {
    expect(resolvePeriodRange({ period_type: "DAY", date: "2026-10-03" })).toEqual({
      start: "2026-10-03",
      end: "2026-10-03",
    });
    expect(
      resolvePeriodRange({ period_type: "RANGE", from: "2026-01-25", to: "2026-03-05" })
    ).toEqual({
      start: "2026-01-25",
      end: "2026-03-05",
    });
  });

  it("MONTH abarca del día 1 al último día del mes", () => {
    expect(resolvePeriodRange({ period_type: "MONTH", month: "2026-10" })).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(resolvePeriodRange({ period_type: "MONTH", month: "2028-02" }).end).toBe("2028-02-29");
  });

  it("NONE no tiene rango propio (se deriva de los datos, AD-08)", () => {
    expect(resolvePeriodRange({ period_type: "NONE" })).toBeNull();
  });
});

describe("isSingleDayPeriod (RF-1.2.15.5.2)", () => {
  it.each([
    [{ period_type: "DAY", date: "2026-10-03" }, true],
    [{ period_type: "RANGE", from: "2026-10-03", to: "2026-10-03" }, true],
    [{ period_type: "RANGE", from: "2026-10-02", to: "2026-10-03" }, false],
    [{ period_type: "MONTH", month: "2026-10" }, false],
    [{ period_type: "NONE" }, false],
  ])("%s → %s", (filters, expected) => {
    expect(isSingleDayPeriod(filters)).toBe(expected);
  });
});

describe("resolveGranularity (RF-1.2.15.5.2)", () => {
  it("mes → días; rango de 2 a 31 días → días; rango mayor → meses; NONE → meses", () => {
    expect(resolveGranularity({ period_type: "MONTH", month: "2026-10" })).toBe("day");
    expect(resolveGranularity({ period_type: "RANGE", from: "2026-10-01", to: "2026-10-31" })).toBe(
      "day"
    );
    expect(resolveGranularity({ period_type: "RANGE", from: "2026-10-01", to: "2026-11-01" })).toBe(
      "month"
    );
    expect(resolveGranularity({ period_type: "NONE" })).toBe("month");
  });

  it("inclusiveDayCount cuenta los días naturales incluyendo ambos extremos", () => {
    expect(inclusiveDayCount("2026-10-01", "2026-10-31")).toBe(31);
    expect(inclusiveDayCount("2026-10-01", "2026-10-02")).toBe(2);
    expect(inclusiveDayCount("2026-02-28", "2028-02-29")).toBe(732);
  });
});

describe("enumerateIntervals", () => {
  it("días de un mes completo", () => {
    const days = enumerateIntervals("day", "2026-10-01", "2026-10-31");
    expect(days).toHaveLength(31);
    expect(days[2]).toBe("2026-10-03");
    expect(days[30]).toBe("2026-10-31");
  });

  it("meses a caballo de años", () => {
    expect(enumerateIntervals("month", "2025-11-15", "2026-02-03")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("monthLabel recorta a YYYY-MM", () => {
    expect(monthLabel("2026-10-03")).toBe("2026-10");
  });
});

describe("buildBuckets (AD-07)", () => {
  const october = enumerateIntervals("day", "2026-10-01", "2026-10-31");

  it("trunca al último intervalo con registros, conserva los ceros intermedios y genera la nota", () => {
    const { buckets, note } = buildBuckets(october, { "2026-10-03": 1 });

    expect(buckets).toEqual([
      { label: "2026-10-01", count: 0 },
      { label: "2026-10-02", count: 0 },
      { label: "2026-10-03", count: 1 },
    ]);
    expect(note).toBe("Se muestran 3 de 31 intervalos.");
  });

  it("sin truncado no emite nota", () => {
    const { buckets, note } = buildBuckets(["2026-10-01", "2026-10-02"], { "2026-10-02": 4 });

    expect(buckets).toHaveLength(2);
    expect(note).toBeNull();
  });

  it("periodo sin registros produce buckets vacíos", () => {
    expect(buildBuckets(october, {})).toEqual({ buckets: [], note: null });
  });
});

describe("resolveTimeChart", () => {
  it("null para periodo de un único día y sin datos", () => {
    expect(
      resolveTimeChart({
        filters: { period_type: "DAY", date: "2026-10-03" },
        dates: ["2026-10-03"],
      })
    ).toBeNull();
    expect(resolveTimeChart({ filters: { period_type: "NONE" }, dates: [] })).toBeNull();
  });

  it("NONE deriva el rango mensual de los propios datos (AD-08)", () => {
    const { granularity, intervals } = resolveTimeChart({
      filters: { period_type: "NONE" },
      dates: ["2026-03-10", "2026-01-05", "2026-02-20"],
    });

    expect(granularity).toBe("month");
    expect(intervals).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("MONTH enumera los días del mes", () => {
    const { granularity, intervals } = resolveTimeChart({
      filters: { period_type: "MONTH", month: "2026-10" },
      dates: ["2026-10-03"],
    });

    expect(granularity).toBe("day");
    expect(intervals).toHaveLength(31);
  });
});
