import type { SearchQuery } from "@paperback/types";

// Kavita FilterField enum values
export const FILTER_FIELD = {
    seriesName: 1,
    publicationStatus: 2,
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
    libraries: 19,
    readProgress: 20,
} as const;

// Kavita FilterComparison enum values
export const FILTER_COMPARISON = {
    Equal: 0,
    GreaterThan: 1,
    LessThan: 3,
    Contains: 5,
    MustContains: 6,
    // "contains" for names: case-insensitive, matches inside the name
    Matches: 7,
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
    // Conditions that every result must also satisfy, when they cannot be
    // merged in `main`: the results are intersected with this request
    required: FilterGroup | undefined;
}

// Value of the dropdown filters meaning "no restriction"
export const ANY_VALUE = "any";

// Kavita PublicationStatus enum values
export const PUBLICATION_STATUS_OPTIONS = [
    { id: "0", value: "Ongoing" },
    { id: "1", value: "Hiatus" },
    { id: "2", value: "Completed" },
    { id: "3", value: "Cancelled" },
    { id: "4", value: "Ended" },
];

export const READ_STATE_OPTIONS = [
    { id: "unread", value: "Unread" },
    { id: "reading", value: "In progress" },
    { id: "read", value: "Read" },
];

/**
 * Extracts the numeric Kavita id from the tag ids used in the UI:
 * "genres-25:Comedy" (search filters) and "25:Comedy" (discover).
 * Kavita's filters expect ids, not titles.
 */
export function extractTagId(tagId: string): string | undefined {
    return /^(?:[a-z]+-)?(\d+)(?::|$)/.exec(tagId)?.[1];
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
function buildTagPlan(query: SearchQuery): Omit<FilterPlan, "required"> {
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

/**
 * Library, publication status and read state selected in the dropdown filters,
 * as statements that must all be satisfied.
 */
export function parseConstraints(
    query: SearchQuery,
): Kavita.FilterStatementDto[] {
    const statements: Kavita.FilterStatementDto[] = [];

    for (const filter of query.filters ?? []) {
        const value = typeof filter.value === "string" ? filter.value : "";
        if (value === "" || value === ANY_VALUE) continue;

        if (filter.id === "library" && /^\d+$/.test(value)) {
            statements.push({
                comparison: FILTER_COMPARISON.Equal,
                field: FILTER_FIELD.libraries,
                value,
            });
        } else if (filter.id === "status" && /^\d+$/.test(value)) {
            statements.push({
                comparison: FILTER_COMPARISON.Equal,
                field: FILTER_FIELD.publicationStatus,
                value,
            });
        } else if (filter.id === "readState") {
            const progress = (comparison: number, percent: string) => ({
                comparison,
                field: FILTER_FIELD.readProgress,
                value: percent,
            });
            if (value === "unread") {
                statements.push(progress(FILTER_COMPARISON.Equal, "0"));
            } else if (value === "reading") {
                statements.push(
                    progress(FILTER_COMPARISON.GreaterThan, "0"),
                    progress(FILTER_COMPARISON.LessThan, "100"),
                );
            } else if (value === "read") {
                statements.push(progress(FILTER_COMPARISON.Equal, "100"));
            }
        }
    }

    return statements;
}

/**
 * Turns the selected filters into the Kavita requests to run: tags with their
 * include/exclude operators, plus the dropdown constraints (library, status,
 * read state) which are merged in the main request whenever it is ANDed.
 */
export function buildFilterPlan(query: SearchQuery): FilterPlan {
    const plan = buildTagPlan(query);
    const constraints = parseConstraints(query);

    if (constraints.length === 0) return { ...plan, required: undefined };

    if (!plan.main) {
        return {
            ...plan,
            main: {
                statements: constraints,
                combination: FILTER_COMBINATION.And,
            },
            required: undefined,
        };
    }

    // AND (or a single statement, where AND and OR are the same) can take more statements
    if (
        plan.main.combination === FILTER_COMBINATION.And ||
        plan.main.statements.length <= 1
    ) {
        return {
            ...plan,
            main: {
                statements: [...plan.main.statements, ...constraints],
                combination: FILTER_COMBINATION.And,
            },
            required: undefined,
        };
    }

    return {
        ...plan,
        required: {
            statements: constraints,
            combination: FILTER_COMBINATION.And,
        },
    };
}
