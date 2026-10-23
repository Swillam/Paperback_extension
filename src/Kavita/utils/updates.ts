/**
 * Decides whether Paperback must fetch the chapters of a series again, from the
 * "last chapter added" marker saved when the series was last loaded and the one
 * Kavita reports now. Mirrors the update check of the MangaDex extension:
 * only series whose marker changed are refreshed.
 *
 * @param apiMarker `lastChapterAddedUtc` reported by Kavita, undefined when the
 *   series no longer exists or is not accessible
 */
export function shouldRefreshChapters(options: {
    storedMarker: string | undefined;
    apiMarker: string | undefined;
    unreadChapterCount: number | undefined;
    chapterCount: number | undefined;
}): boolean {
    const { storedMarker, apiMarker, unreadChapterCount, chapterCount } =
        options;

    // Deleted or no longer accessible: nothing to fetch
    if (!apiMarker) return false;

    // Still has unread chapters: the user is not waiting for more yet
    if (
        unreadChapterCount !== undefined &&
        chapterCount &&
        unreadChapterCount > 0
    ) {
        return false;
    }

    return apiMarker !== storedMarker;
}

/**
 * Splits a list in chunks of at most `size` elements.
 */
export function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
