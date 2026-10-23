// Dinero y fechas sin coma flotante. La API manda los montos como texto con
// cuatro decimales ("1500.0000") y las fechas como "YYYY-MM-DD".

/** Convierte "1500,50" o "1500.50" en "1500.5000". null si no es un monto. */
export function normalizeMoney(input: string): string | null {
  let value = input.trim().replace(/\s/g, "").replace(/^Bs\.?/i, "");
  if (!value) return null;
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if ((value.match(/\./g) ?? []).length > 1) value = value.replace(/\./g, "");
  if (!/^\d+(\.\d{0,4})?$/.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  return `${integer}.${(fraction + "0000").slice(0, 4)}`;
}

function toScaled(value: string): bigint {
  const normalized = normalizeMoney(value);
  if (normalized === null) throw new Error(`Monto inválido: ${value}`);
  const [integer, fraction] = normalized.split(".");
  return BigInt(integer) * 10000n + BigInt(fraction);
}

function fromScaled(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integer = absolute / 10000n;
  const fraction = (absolute % 10000n).toString().padStart(4, "0");
  return `${negative ? "-" : ""}${integer}.${fraction}`;
}

/** Suma montos de texto con precisión exacta. */
export function addMoney(values: string[]): string {
  return fromScaled(values.reduce((total, value) => total + toScaled(value), 0n));
}

export function moneyEqual(a: string, b: string): boolean {
  return toScaled(a) === toScaled(b);
}

/** Resta exacta de dos montos de texto. */
export function subMoney(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}

/** "1500.0000" → "1.500,00". Sin redondear: conserva los decimales con valor. */
export function money(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "-" : ""}${grouped},${decimals}`;
}

/** "2026-10-23" → "23/10/2026". Sin Date: evita el corrimiento de zona. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** Marca de tiempo ISO → "23/10/2026 14:05" en hora local. */
export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function todayISO(): string {
  const date = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export function currentPeriod<T extends { start_date: string; end_date: string }>(
  periods: T[],
): T | undefined {
  const today = todayISO();
  const day = (value: string) => value.slice(0, 10);
  return (
    periods.find((period) => day(period.start_date) <= today && today <= day(period.end_date)) ??
    periods[0]
  );
}

export const ENTRY_TYPES = [
  ["INGRESO", "Ingreso"],
  ["EGRESO", "Egreso"],
  ["DIARIO", "Diario"],
  ["AJUSTE", "Ajuste"],
  ["CIERRE", "Cierre"],
] as const;

export const CLASSIFICATIONS = [
  "ACTIVO",
  "PASIVO",
  "PATRIMONIO",
  "INGRESO",
  "COSTO",
  "GASTO",
  "ORDEN",
] as const;

export const ROLE_NAMES: Record<string, string> = {
  CONTADOR_PRINCIPAL: "Administrador Único",
  CONTADOR_SECUNDARIO: "Contador Secundario",
  ASISTENTE: "Asistente",
  CLIENTE: "Cliente",
};

export const REPORT_KINDS = [
  ["balance", "Balance de comprobación"],
  ["estado-resultados", "Estado de resultados"],
  ["estado-situacion", "Estado de situación financiera"],
  ["libro-diario", "Libro Diario"],
  ["libro-mayor", "Libro Mayor"],
  ["libro-compras", "Libro de compras"],
  ["libro-ventas", "Libro de ventas"],
  ["comprobante-retencion", "Comprobante de retención"],
  ["conciliacion-bancaria", "Conciliación bancaria"],
] as const;

export const SYNC_REPORT_KINDS = [
  "balance",
  "estado-resultados",
  "estado-situacion",
] as const;
