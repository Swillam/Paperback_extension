/**
 * Whether a count reaches a threshold: 0 never, 1 means "at least one", any
 * other value is a percentage of the total.
 */
export function shouldSkipByCount(
    threshold: number,
    count: number | undefined,
    total: number | undefined,
): boolean {
    if (threshold <= 0 || count === undefined || !total) return false;
    if (threshold === 1) return count > 0;
    return (count / total) * 100 >= threshold;
}

export interface UpdateCheckOptions {
    storedMarker: string | undefined;
    // `lastChapterAddedUtc` reported by Kavita, undefined when the series no
    // longer exists or is not accessible
    apiMarker: string | undefined;
    unreadChapterCount: number | undefined;
    newChapterCount?: number | undefined;
    chapterCount: number | undefined;
    // Publication status stored with the series ("Completed"...)
    status?: string | undefined;
    // User settings, same meaning as in the MangaDex extension
    skipUnread?: number;
    skipNew?: number;
    skipStatuses?: readonly string[];
}

/**
 * Decides whether Paperback must fetch the chapters of a series again, from the
 * "last chapter added" marker saved when the series was last loaded and the one
 * Kavita reports now. Only series whose marker changed are refreshed, unless
 * the user asked to skip them by unread or new chapters, or by status.
 */
export function shouldRefreshChapters(options: UpdateCheckOptions): boolean {
    const {
        storedMarker,
        apiMarker,
        unreadChapterCount,
        newChapterCount,
        chapterCount,
        status,
        skipUnread = 1,
        skipNew = 0,
        skipStatuses = [],
    } = options;

    // Deleted or no longer accessible: nothing to fetch
    if (!apiMarker) return false;

    if (shouldSkipByCount(skipUnread, unreadChapterCount, chapterCount)) {
        return false;
    }
    if (shouldSkipByCount(skipNew, newChapterCount, chapterCount)) {
        return false;
    }
    if (status !== undefined && skipStatuses.includes(status)) return false;

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

/**
 * Settings subtitle of a skip threshold ("Off", "Skipping 1+ unread"...).
 */
export function describeSkip(threshold: number, noun: string): string {
    if (threshold <= 0) return "Off";
    return threshold === 1
        ? `Skipping series with 1+ ${noun} chapters`
        : `Skipping series with ${threshold}%+ ${noun} chapters`;
}

/**
 * Choices of a skip threshold setting.
 */
export function skipThresholdOptions(
    noun: string,
): { id: string; title: string }[] {
    return [
        { id: "0", title: "Don't skip" },
        { id: "1", title: `1+ ${noun}` },
        { id: "25", title: "25%+" },
        { id: "50", title: "50%+" },
        { id: "75", title: "75%+" },
        { id: "100", title: "100%" },
    ];
}
