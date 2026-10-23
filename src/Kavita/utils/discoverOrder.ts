// Groups of Discover sections the user can reorder, in their default order
export const DISCOVER_GROUPS = [
    "ondeck",
    "latest_updates",
    "recently_added",
    "tag_sections",
    "libraries",
    "smart_filters",
] as const;

/**
 * Saved order made safe: unknown or repeated ids are dropped and the groups
 * missing from it (added by a later version) are appended in the default order.
 */
export function normalizeOrder(saved: unknown): string[] {
    const known: readonly string[] = DISCOVER_GROUPS;
    const order: string[] = [];

    if (Array.isArray(saved)) {
        for (const id of saved) {
            if (
                typeof id === "string" &&
                known.includes(id) &&
                !order.includes(id)
            ) {
                order.push(id);
            }
        }
    }
    for (const id of DISCOVER_GROUPS) {
        if (!order.includes(id)) order.push(id);
    }
    return order;
}

/**
 * A copy of the list with the items at `from` and `to` swapped, or null when
 * `to` is out of range.
 */
export function swapItems<T>(
    items: readonly T[],
    from: number,
    to: number,
): T[] | null {
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
        return null;
    }
    const next = items.slice();
    const moved = next[from];
    next[from] = next[to];
    next[to] = moved;
    return next;
}
