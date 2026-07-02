/** Shared display formatters. API numerics (Postgres NUMERIC) may arrive as
 * strings, so coerce with Number() before formatting. */

export const fmtMoney = (n: number | string) =>
  Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

export const fmtInt = (n: number | string) => Number(n).toLocaleString("en-US");
