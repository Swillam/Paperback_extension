/**
 * Oldest Kavita version the extension is expected to work with. Collections,
 * smart filters and the id-based filters are used throughout; it was only
 * tested with 0.9.
 */
export const RECOMMENDED_KAVITA_VERSION = [0, 8];

/**
 * Parses a version like "0.9.1.4" into its numbers (empty when it is not one).
 */
export function parseVersion(version: string): number[] {
    const parts = version.trim().split(".");
    const numbers = parts.map((part) => parseInt(part));
    return numbers.some((n) => !Number.isFinite(n)) ? [] : numbers;
}

/**
 * Whether a version is strictly older than the given one. Unknown versions are
 * not reported as old.
 */
export function isOlderThan(version: string, minimum: number[]): boolean {
    const numbers = parseVersion(version);
    if (numbers.length === 0) return false;

    for (let i = 0; i < Math.max(numbers.length, minimum.length); i++) {
        const a = numbers[i] ?? 0;
        const b = minimum[i] ?? 0;
        if (a !== b) return a < b;
    }
    return false;
}
