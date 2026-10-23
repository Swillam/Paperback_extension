export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

function toNumber(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") return parseInt(raw);
    return NaN;
}

/**
 * Parses the user-provided page size, falling back to the default when the
 * value is empty, not a number or not positive, and capping it at MAX_PAGE_SIZE.
 */
export function parsePageSize(raw: unknown): number {
    const value = toNumber(raw);
    if (!Number.isFinite(value) || value < 1) return DEFAULT_PAGE_SIZE;
    return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}

/**
 * Parses an integer id coming from additionalInfo (stored as a string),
 * returning the fallback when it is missing or not a number.
 */
export function toInt(raw: unknown, fallback = 0): number {
    const value = toNumber(raw);
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
}
