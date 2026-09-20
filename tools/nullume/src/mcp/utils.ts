import { ProviderError } from "../core/errors.js";

export function formatError(error: unknown): string {
  if (error instanceof ProviderError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatPrice(credits: number, usdPerCredit: number = 0.005): number {
  return Number((credits * usdPerCredit).toFixed(4));
}

export function truncateList<T>(items: T[], limit: number, maxItems: number = 60): [T[], number] {
  if (items.length > maxItems) {
    return [items.slice(0, maxItems), items.length - maxItems];
  }
  return [items, 0];
}
