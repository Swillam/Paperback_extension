export const WANT_TO_READ_ID = "want-to-read";
const COLLECTION_PREFIX = "collection-";

export type CollectionRef =
    { kind: "want-to-read" } | { kind: "collection"; id: number };

/**
 * Paperback collection id of a Kavita collection ("collection-5").
 */
export function collectionManagedId(id: number): string {
    return `${COLLECTION_PREFIX}${id}`;
}

/**
 * Tells which Kavita list a Paperback managed collection id stands for.
 */
export function parseCollectionRef(id: string): CollectionRef | undefined {
    if (id === WANT_TO_READ_ID) return { kind: "want-to-read" };

    const match = /^collection-(\d+)$/.exec(id);
    return match?.[1]
        ? { kind: "collection", id: parseInt(match[1]) }
        : undefined;
}
