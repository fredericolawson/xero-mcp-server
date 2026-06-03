import { CurrencyCode } from "xero-node";

/**
 * Validate and convert a 3-letter ISO currency string into the SDK's
 * CurrencyCode enum.
 *
 * Returns undefined for empty input, and throws a user-meaningful error for
 * unsupported codes. xero-node's .d.ts declares CurrencyCode without its string
 * values, so TypeScript types it as numeric; at runtime the enum values ARE the
 * 3-letter strings (e.g. CurrencyCode.GBP === "GBP"), which is exactly what the
 * API expects — hence the cast through unknown.
 */
export function resolveCurrencyCode(
  currencyCode?: string,
): CurrencyCode | undefined {
  if (!currencyCode) return undefined;
  const code = currencyCode.toUpperCase();
  if (!(code in CurrencyCode)) {
    throw new Error(
      `Unsupported currency code: "${currencyCode}". Use a 3-letter ISO code such as GBP, EUR or USD.`,
    );
  }
  return code as unknown as CurrencyCode;
}
