/**
 * Alternative titles of a series: Kavita often repeats the same name in its
 * name, original name, localized name and sort name fields.
 */
export function secondaryTitles(
    primaryTitle: string,
    candidates: (string | null | undefined)[],
): string[] {
    const seen = new Set([normalize(primaryTitle)]);
    const titles: string[] = [];

    for (const candidate of candidates) {
        const title = candidate?.trim();
        if (!title || seen.has(normalize(title))) continue;
        seen.add(normalize(title));
        titles.push(title);
    }
    return titles;
}

function normalize(title: string): string {
    return title.trim().toLowerCase();
}

const MAX_LISTED_NAMES = 10;

function names(people: { name: string }[] | undefined): string {
    const unique = [
        ...new Set((people ?? []).map((p) => p.name.trim())),
    ].filter((name) => name !== "");
    const shown = unique.slice(0, MAX_LISTED_NAMES).join(", ");
    return unique.length > MAX_LISTED_NAMES
        ? `${shown} (+${unique.length - MAX_LISTED_NAMES})`
        : shown;
}

/**
 * One line per available piece of information, empty ones are skipped.
 */
export function seriesInfoLines(metadata: {
    releaseYear?: number;
    language?: string;
    publishers?: { name: string }[];
    translators?: { name: string }[];
    characters?: { name: string }[];
}): string[] {
    const lines: [string, string][] = [
        [
            "Year",
            metadata.releaseYear && metadata.releaseYear > 0
                ? String(metadata.releaseYear)
                : "",
        ],
        ["Language", metadata.language?.trim() ?? ""],
        ["Publisher", names(metadata.publishers)],
        ["Translator", names(metadata.translators)],
        ["Characters", names(metadata.characters)],
    ];

    return lines
        .filter(([, value]) => value !== "")
        .map(([label, value]) => `${label}: ${value}`);
}

/**
 * Series summary (Kavita returns HTML) followed by the extra information.
 */
export function buildSynopsis(summary: string, infoLines: string[]): string {
    const text = summary.replace(/<[^>]+>/g, "").trim();
    return [text, infoLines.join("\n")]
        .filter((part) => part !== "")
        .join("\n\n");
}
