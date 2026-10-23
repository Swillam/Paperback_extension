/**
 * Metadata of the next page of a Discover section, or undefined when the last
 * page was reached (a page that is not full means there is nothing after it).
 * `page` is the 1-based page that was just loaded; the metadata stores it so
 * the next call asks for the following one.
 */
export function nextPageMetadata(
    itemCount: number,
    pageSize: number,
    page: number,
    previous: { collectedIds?: string[] } | undefined,
): { offset: number; collectedIds: string[] | undefined } | undefined {
    if (itemCount < pageSize) return undefined;
    return { offset: page, collectedIds: previous?.collectedIds };
}

/**
 * 1-based page to load from the metadata returned with the previous page.
 */
export function pageFromMetadata(
    metadata: { offset?: number } | undefined,
): number {
    return (metadata?.offset ?? 0) + 1;
}
