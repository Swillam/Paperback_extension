import type { SearchQuery } from "@paperback/types";

// Kavita FilterField enum values
export const FILTER_FIELD = {
    tags: 6,
    characters: 9,
    publisher: 10,
    editor: 11,
    coverArtist: 12,
    letterer: 13,
    colorist: 14,
    inker: 15,
    penciller: 16,
    writers: 17,
    genres: 18,
} as const;

// Kavita FilterComparison enum values
export const FILTER_COMPARISON = {
    Contains: 5,
    MustContains: 6,
    NotContains: 8,
} as const;

// Kavita FilterCombination enum values
export const FILTER_COMBINATION = {
    Or: 0,
    And: 1,
} as const;

/**
 * Extracts filter statements from query filters
 */
export function buildFilterStatements(query: SearchQuery): {
    includeStatements: Kavita.FilterStatementDto[];
    excludeStatements: Kavita.FilterStatementDto[];
    includeCombination: number;
    excludeCombination: number;
} {
    const includeStatements: Kavita.FilterStatementDto[] = [];
    const excludeStatements: Kavita.FilterStatementDto[] = [];
    let includeCombination: number = FILTER_COMBINATION.And;
    let excludeCombination: number = FILTER_COMBINATION.Or;

    if (!query.filters || query.filters.length === 0) {
        return {
            includeStatements,
            excludeStatements,
            includeCombination,
            excludeCombination,
        };
    }

    // Map tag section IDs to Kavita FilterField values
    const tagSectionToField: Record<string, number> = {
        "tags-genres": FILTER_FIELD.genres,
        "tags-people": FILTER_FIELD.writers,
        "tags-tags": FILTER_FIELD.tags,
    };

    for (const filter of query.filters) {
        if (filter.id === "includeOperator") {
            includeCombination =
                filter.value === "OR"
                    ? FILTER_COMBINATION.Or
                    : FILTER_COMBINATION.And;
            continue;
        }
        if (filter.id === "excludeOperator") {
            excludeCombination =
                filter.value === "OR"
                    ? FILTER_COMBINATION.Or
                    : FILTER_COMBINATION.And;
            continue;
        }

        const field = tagSectionToField[filter.id];
        if (field === undefined) continue;

        const filterValue = filter.value as Record<string, string>;
        if (!filterValue || typeof filterValue !== "object") continue;

        for (const [tagId, status] of Object.entries(filterValue)) {
            const tagTitle = resolveTagTitle(tagId, query);
            if (!tagTitle) continue;

            if (status === "included") {
                includeStatements.push({
                    comparison: FILTER_COMPARISON.Contains,
                    field: field,
                    value: tagTitle,
                });
            } else if (status === "excluded") {
                excludeStatements.push({
                    comparison: FILTER_COMPARISON.NotContains,
                    field: field,
                    value: tagTitle,
                });
            }
        }
    }

    return {
        includeStatements,
        excludeStatements,
        includeCombination,
        excludeCombination,
    };
}

/**
 * Resolves a tag ID to its display title.
 * First tries to find it in filter options (search filters UI),
 * then falls back to extracting from the tag ID format "category:title"
 * (used by Discover genre carousel items).
 */
function resolveTagTitle(
    tagId: string,
    query: SearchQuery,
): string | undefined {
    // Try to find title from filter options (when coming from search filters)
    if (query.filters) {
        for (const filter of query.filters) {
            const options = (filter as Record<string, unknown>).options as
                { id: string; value: string }[] | undefined;
            if (!options || !Array.isArray(options)) continue;

            const match = options.find((opt) => opt.id === tagId);
            if (match) return match.value;
        }
    }

    // Fallback: extract title from tag ID format "category:title"
    // (used when search is triggered from Discover genre tags)
    const colonIndex = tagId.indexOf(":");
    if (colonIndex !== -1) {
        return tagId.substring(colonIndex + 1);
    }

    return undefined;
}
