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

export interface FilterGroup {
    statements: Kavita.FilterStatementDto[];
    combination: number;
}

/**
 * How to run a tag search against Kavita, whose filter DTO only has ONE
 * combination operator for all its statements.
 * - `main` is the request to page through.
 * - `excluded`, when present, is a second request whose results must be
 *   removed from the main results (used when include/exclude operators
 *   cannot be expressed in a single request).
 */
export interface FilterPlan {
    main: FilterGroup | undefined;
    excluded: FilterGroup | undefined;
}

/**
 * Extracts the numeric Kavita id from the tag ids used in the UI:
 * "genres-25:Comedy" (search filters) and "25:Comedy" (discover).
 * Kavita's filters expect ids, not titles.
 */
export function extractTagId(tagId: string): string | undefined {
    return /^(?:[a-z]+-)?(\d+):/.exec(tagId)?.[1];
}

/**
 * Reads the include/exclude tags and operators selected in the search filters.
 */
export function parseFilters(query: SearchQuery): {
    include: Kavita.FilterStatementDto[];
    exclude: Kavita.FilterStatementDto[];
    includeCombination: number;
    excludeCombination: number;
} {
    const include: Kavita.FilterStatementDto[] = [];
    const exclude: Kavita.FilterStatementDto[] = [];
    let includeCombination: number = FILTER_COMBINATION.And;
    let excludeCombination: number = FILTER_COMBINATION.Or;

    // Map tag section IDs to Kavita FilterField values
    const tagSectionToField: Record<string, number> = {
        "tags-genres": FILTER_FIELD.genres,
        "tags-people": FILTER_FIELD.writers,
        "tags-tags": FILTER_FIELD.tags,
    };

    for (const filter of query.filters ?? []) {
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
            const id = extractTagId(tagId);
            if (id === undefined) continue;

            const statement = {
                comparison: FILTER_COMPARISON.Contains,
                field: field,
                value: id,
            };
            if (status === "included") include.push(statement);
            else if (status === "excluded") exclude.push(statement);
        }
    }

    return { include, exclude, includeCombination, excludeCombination };
}

/**
 * Turns the selected filters into the Kavita requests to run.
 *
 * "Exclude operator OR" means "drop series having ANY excluded tag", which is
 * "NOT tag1 AND NOT tag2" for Kavita; "AND" means "drop series having ALL of
 * them", i.e. "NOT tag1 OR NOT tag2". When that cannot be combined with the
 * include statements in one request, the excluded series are fetched
 * separately and removed from the results.
 */
export function buildFilterPlan(query: SearchQuery): FilterPlan {
    const { include, exclude, includeCombination, excludeCombination } =
        parseFilters(query);

    if (include.length === 0 && exclude.length === 0) {
        return { main: undefined, excluded: undefined };
    }

    const negate = (
        statements: Kavita.FilterStatementDto[],
    ): Kavita.FilterStatementDto[] =>
        statements.map((s) => ({
            ...s,
            comparison: FILTER_COMPARISON.NotContains,
        }));

    // Only includes
    if (exclude.length === 0) {
        return {
            main: { statements: include, combination: includeCombination },
            excluded: undefined,
        };
    }

    const excludeAny = excludeCombination === FILTER_COMBINATION.Or;

    // Only excludes
    if (include.length === 0) {
        return {
            main: {
                statements: negate(exclude),
                combination: excludeAny
                    ? FILTER_COMBINATION.And
                    : FILTER_COMBINATION.Or,
            },
            excluded: undefined,
        };
    }

    // Includes and "exclude any" fit in one request when includes are ANDed
    // (or a single include, where AND and OR are the same)
    if (
        excludeAny &&
        (includeCombination === FILTER_COMBINATION.And || include.length === 1)
    ) {
        return {
            main: {
                statements: [...include, ...negate(exclude)],
                combination: FILTER_COMBINATION.And,
            },
            excluded: undefined,
        };
    }

    // Otherwise: includes first, then remove the series matching the excluded tags
    return {
        main: { statements: include, combination: includeCombination },
        excluded: { statements: exclude, combination: excludeCombination },
    };
}
