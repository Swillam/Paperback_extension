const FILE_EXTENSION = /\.(cbz|cbr|cb7|cbt|zip|rar|7z|tar|epub|pdf)$/i;

// Kavita uses this date when a chapter has no release date
const EMPTY_RELEASE_DATE = "0001-01-01T00:00:00";

/**
 * Removes a known archive/book extension from a file name (specials are named after their file).
 * Unknown extensions are left untouched instead of cutting arbitrary characters.
 */
export function stripFileExtension(name: string): string {
    return name.replace(FILE_EXTENSION, "");
}

/**
 * Display name of a regular chapter.
 */
export function chapterName(chapter: {
    number: string;
    range: string;
    titleName?: string | null;
}): string {
    if (chapter.number === chapter.range) return chapter.titleName ?? "";

    const range = chapter.range.replace(`${chapter.number}-`, "");
    return chapter.titleName ? `${range} - ${chapter.titleName}` : range;
}

/**
 * Release date of a chapter, falling back to its creation date.
 */
export function chapterDate(releaseDate: string, created: string): Date {
    return new Date(releaseDate === EMPTY_RELEASE_DATE ? created : releaseDate);
}

/**
 * A chapter is read once every page has been read.
 */
export function isChapterRead(pages: number, pagesRead: number): boolean {
    return pages > 0 && pagesRead >= pages;
}
