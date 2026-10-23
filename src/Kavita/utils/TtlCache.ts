/**
 * Tiny in-memory cache whose entries expire after a given time.
 */
export class TtlCache<V> {
    private entries = new Map<string, { expiresAt: number; value: V }>();

    constructor(
        private ttlMs: number,
        private now: () => number = () => Date.now(),
    ) {}

    get(key: string): V | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: V): void {
        this.entries.set(key, { expiresAt: this.now() + this.ttlMs, value });
    }

    delete(key: string): void {
        this.entries.delete(key);
    }
}
