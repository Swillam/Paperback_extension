/**
 * Metadata of the next page of a Discover section or of a search, or undefined
 * when the last page was reached (a page that is not full means there is
 * nothing after it). `page` is the 1-based page that was just loaded; the
 * metadata stores it so the next call asks for the following one.
 *
 * Paperback saves the metadata as JSON and refuses a value that is undefined,
 * so it only holds what is always defined.
 */
export function nextPageMetadata(
    itemCount: number,
    pageSize: number,
    page: number,
): { offset: number } | undefined {
    return itemCount < pageSize ? undefined : { offset: page };
}

/**
 * 1-based page to load from the metadata returned with the previous page.
 */
export function pageFromMetadata(
    metadata: { offset?: number } | undefined,
): number {
    return (metadata?.offset ?? 0) + 1;
}
