// All money is stored as integer minor units (cents). These helpers keep the
// conversions in one place so we never do floating-point math on currency.

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format((cents ?? 0) / 100);
}

export function dollarsToCents(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

// Apply a channel markup percentage to a base catalog price.
export function applyMarkup(baseCents: number, markupPct: number): number {
  return Math.round(baseCents * (1 + (markupPct || 0) / 100));
}
