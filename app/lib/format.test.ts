import { describe, expect, it } from "vitest";
import { addMoney, currentPeriod, money, moneyEqual, normalizeMoney, shortDate, subMoney, todayISO } from "./format";

describe("normalizeMoney", () => {
  it("acepta punto y coma decimales", () => {
    expect(normalizeMoney("1500.5")).toBe("1500.5000");
    expect(normalizeMoney("1500,5")).toBe("1500.5000");
  });

  it("interpreta el punto como separador de miles cuando hay coma", () => {
    expect(normalizeMoney("1.500.000,25")).toBe("1500000.2500");
  });

  it("quita separadores de miles sin coma", () => {
    expect(normalizeMoney("1.500.000")).toBe("1500000.0000");
  });

  it("ignora el símbolo de bolívares y los espacios", () => {
    expect(normalizeMoney(" Bs. 12,00 ")).toBe("12.0000");
  });

  it("rechaza lo que no es un monto", () => {
    expect(normalizeMoney("")).toBeNull();
    expect(normalizeMoney("abc")).toBeNull();
    expect(normalizeMoney("1,234.56")).toBeNull();
    expect(normalizeMoney("1.23456")).toBeNull();
  });
});

describe("aritmética exacta", () => {
  it("suma sin error de coma flotante", () => {
    expect(addMoney(["0.1000", "0.2000"])).toBe("0.3000");
    expect(addMoney(["1.0000", "2.5000", "3.2500"])).toBe("6.7500");
  });

  it("suma montos grandes sin perder precisión", () => {
    expect(addMoney(["99999999999.9999", "0.0001"])).toBe("100000000000.0000");
  });

  it("resta y da resultados negativos", () => {
    expect(subMoney("10.0000", "9.5000")).toBe("0.5000");
    expect(subMoney("1.0000", "3.0000")).toBe("-2.0000");
  });

  it("compara por valor, no por texto", () => {
    expect(moneyEqual("10", "10.0000")).toBe(true);
    expect(moneyEqual("10.0000", "10.0001")).toBe(false);
  });
});

describe("formato de pantalla", () => {
  it("agrupa miles con punto y decimales con coma", () => {
    expect(money("1500000.2500")).toBe("1.500.000,25");
    expect(money("0.0000")).toBe("0,00");
    expect(money("-42.5000")).toBe("-42,50");
    expect(money(null)).toBe("—");
  });

  it("acorta fechas sin usar Date", () => {
    expect(shortDate("2026-10-23")).toBe("23/10/2026");
    expect(shortDate("2026-10-23T00:00:00Z")).toBe("23/10/2026");
    expect(shortDate(null)).toBe("—");
  });

  it("elige el período de hoy aunque la API mande RFC3339", () => {
    const today = todayISO();
    const periods = [
      { id: "pasado", start_date: "2000-01-01T00:00:00Z", end_date: "2000-01-31T00:00:00Z" },
      { id: "hoy", start_date: `${today}T00:00:00Z`, end_date: `${today}T00:00:00Z` },
    ];
    expect(currentPeriod(periods)).toBe(periods[1]);
  });
});
