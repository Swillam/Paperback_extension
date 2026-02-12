import {
    PagedResults,
    Request,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    Tag,
    TagSection,
} from "@paperback/types";
import {
    getKavitaApiKey,
    getKavitaEnableRecursiveSearch,
    getKavitaPageSize,
    getKavitaUrl,
} from "../settings";
import { fetchJSON } from "../utils/CommonUtils";

// Kavita FilterField enum values
const FILTER_FIELD = {
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
const FILTER_COMPARISON = {
    Contains: 5,
    MustContains: 6,
    NotContains: 8,
} as const;

// Kavita FilterCombination enum values
const FILTER_COMBINATION = {
    Or: 0,
    And: 1,
} as const;

/**
 * Handles manga search functionality and filters
 */
export class SearchProvider {
    /**
     * Returns tag sections for manga search filters
     */
    async getSearchTags(): Promise<TagSection[]> {
        const kavitaURL = getKavitaUrl();

        const includeLibraryIds: string[] = [];

        const libraryRequest = {
            url: `${kavitaURL}/Library/libraries`,
            method: "GET",
        };

        const libraryResult =
            await fetchJSON<Kavita.AllLibraries>(libraryRequest);

        for (const library of libraryResult) {
            if (library.type === 2) continue;
            includeLibraryIds.push(library.id.toString());
        }

        const tagNames: string[] = ["genres", "people", "tags"];
        const tagSections: TagSection[] = [];

        for (const tagName of tagNames) {
            const libraryParam = includeLibraryIds.length > 0 ? `?libraryIds=${includeLibraryIds.join(",")}` : "";
            const request = {
                url: `${kavitaURL}/Metadata/${tagName}${libraryParam}`,
                method: "GET",
            };

            const tags: Tag[] = [];

            if (tagName === "people") {
                const result = await fetchJSON<Kavita.Contributor[]>(request);
                const names: string[] = [];
                for (const item of result) {
                    if (!names.includes(item.name)) {
                        names.push(item.name);
                        tags.push({
                            id: `${tagName}-${item.id}:${item.name.replaceAll(" ", "_")}`,
                            title: item.name,
                        });
                    }
                }
            } else {
                const result = await fetchJSON<Kavita.Genre[]>(request);
                for (const item of result) {
                    tags.push({
                        id: `${tagName}-${item.id}:${item.title.replaceAll(" ", "_")}`,
                        title: item.title,
                    });
                }
            }

            tagSections.push({
                id: tagName,
                title: tagName,
                tags: tags,
            });
        }

        return tagSections;
    }

    /**
     * Builds search filter UI components
     */
    async getSearchFilters(): Promise<SearchFilter[]> {
        const filters: SearchFilter[] = [];

        filters.push({
            id: "includeOperator",
            type: "dropdown",
            options: [
                { id: "AND", value: "AND" },
                { id: "OR", value: "OR" },
            ],
            value: "AND",
            title: "Include Operator",
        });

        filters.push({
            id: "excludeOperator",
            type: "dropdown",
            options: [
                { id: "AND", value: "AND" },
                { id: "OR", value: "OR" },
            ],
            value: "OR",
            title: "Exclude Operator",
        });

        const tags = await this.getSearchTags();
        for (const tag of tags) {
            filters.push({
                type: "multiselect",
                options: tag.tags.map((x) => ({ id: x.id, value: x.title })),
                id: "tags-" + tag.id,
                allowExclusion: true,
                title: tag.title,
                value: {},
                allowEmptySelection: true,
                maximum: undefined,
            });
        }

        return filters;
    }

    /**
     * Extracts filter statements from query filters
     */
    private buildFilterStatements(
        query: SearchQuery,
    ): {
        includeStatements: Kavita.FilterStatementDto[];
        excludeStatements: Kavita.FilterStatementDto[];
        includeCombination: number;
        excludeCombination: number;
    } {
        const includeStatements: Kavita.FilterStatementDto[] = [];
        const excludeStatements: Kavita.FilterStatementDto[] = [];
        let includeCombination = FILTER_COMBINATION.And;
        let excludeCombination = FILTER_COMBINATION.Or;

        if (!query.filters || query.filters.length === 0) {
            return { includeStatements, excludeStatements, includeCombination, excludeCombination };
        }

        // Map tag section IDs to Kavita FilterField values
        const tagSectionToField: Record<string, number> = {
            "tags-genres": FILTER_FIELD.genres,
            "tags-people": FILTER_FIELD.writers,
            "tags-tags": FILTER_FIELD.tags,
        };

        for (const filter of query.filters) {
            if (filter.id === "includeOperator") {
                includeCombination = filter.value === "OR"
                    ? FILTER_COMBINATION.Or
                    : FILTER_COMBINATION.And;
                continue;
            }
            if (filter.id === "excludeOperator") {
                excludeCombination = filter.value === "OR"
                    ? FILTER_COMBINATION.Or
                    : FILTER_COMBINATION.And;
                continue;
            }

            const field = tagSectionToField[filter.id];
            if (field === undefined) continue;

            const filterValue = filter.value as Record<string, string>;
            if (!filterValue || typeof filterValue !== "object") continue;

            for (const [tagId, status] of Object.entries(filterValue)) {
                const tagTitle = this.resolveTagTitle(tagId, query);
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

        return { includeStatements, excludeStatements, includeCombination, excludeCombination };
    }

    /**
     * Resolves a tag ID to its display title.
     * First tries to find it in filter options (search filters UI),
     * then falls back to extracting from the tag ID format "category:title"
     * (used by Discover genre carousel items).
     */
    private resolveTagTitle(
        tagId: string,
        query: SearchQuery,
    ): string | undefined {
        // Try to find title from filter options (when coming from search filters)
        if (query.filters) {
            for (const filter of query.filters) {
                const options = (filter as Record<string, unknown>).options as
                    | { id: string; value: string }[]
                    | undefined;
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

    /**
     * Executes manga search with filters and returns results
     */
    async getSearchResults(
        query: SearchQuery,
        metadata: Kavita.Metadata,
    ): Promise<PagedResults<SearchResultItem>> {
        const kavitaAPI = getKavitaApiKey();
        const kavitaURL = getKavitaUrl();
        const pageSize: number = +getKavitaPageSize();
        const enableRecursiveSearch = getKavitaEnableRecursiveSearch();
        const page: number = metadata?.offset ?? 0;

        const titleSearchIds: string[] = [];

        const tagSearchTiles: SearchResultItem[] = [];
        const titleSearchTiles: SearchResultItem[] = [];

        let result: SearchResultItem[] = [];

        // Handle text-based search
        if (typeof query.title === "string" && query.title !== "") {
            const titleRequest = {
                url: `${kavitaURL}/Search/search?queryString=${encodeURIComponent(query.title)}`,
                method: "GET",
            };

            const titleResult =
                await fetchJSON<Kavita.SearchResponse>(titleRequest);

            for (const manga of titleResult?.series ?? []) {
                if (!manga.name) continue;
                titleSearchIds.push(`${manga.seriesId}`);
                titleSearchTiles.push({
                    title: manga.name,
                    imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.seriesId}&apiKey=${kavitaAPI}`,
                    mangaId: `${manga.seriesId}`,
                });
            }

            if (enableRecursiveSearch) {
                for (const person of titleResult?.persons ?? []) {
                    const personName =
                        (person as unknown as { name: string }).name;
                    if (!personName) continue;

                    const personRequest: Request = {
                        url: `${kavitaURL}/Series/all-v2?PageNumber=1&PageSize=${pageSize}`,
                        body: JSON.stringify({
                            id: 0,
                            name: "filter-persons",
                            statements: this.createSearchQuery(personName),
                            combination: FILTER_COMBINATION.Or,
                            sortOptions: {
                                sortField: 1,
                                isAscending: true,
                            },
                            limitTo: 0,
                        }),
                        method: "POST",
                    };

                    const personResult =
                        await fetchJSON<Kavita.SerieResponse[]>(personRequest);

                    for (const manga of personResult ?? []) {
                        if (
                            !titleSearchIds.includes(`${manga.id}`) &&
                            manga.name
                        ) {
                            titleSearchIds.push(`${manga.id}`);
                            titleSearchTiles.push({
                                title: manga.name,
                                imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${kavitaAPI}`,
                                mangaId: `${manga.id}`,
                            });
                        }
                    }
                }

                const metaTagNames: (keyof Kavita.SearchResponse)[] = [
                    "genres",
                    "tags",
                ];

                for (const tagName of metaTagNames) {
                    for (const item of titleResult?.[tagName] ?? []) {
                        const tagTitle = (item as Kavita.Genre).title;
                        if (!tagTitle) continue;

                        const tagRequest: Request = {
                            url: `${kavitaURL}/Series/all-v2?PageNumber=1&PageSize=${pageSize}`,
                            body: JSON.stringify({
                                id: 0,
                                name: `filter-${tagName}`,
                                statements: [
                                    {
                                        comparison:
                                            FILTER_COMPARISON.Contains,
                                        field: FILTER_FIELD[
                                            tagName as keyof typeof FILTER_FIELD
                                        ],
                                        value: tagTitle,
                                    },
                                ],
                                combination: FILTER_COMBINATION.Or,
                                sortOptions: {
                                    sortField: 1,
                                    isAscending: true,
                                },
                                limitTo: 0,
                            }),
                            method: "POST",
                        };

                        const tagResult =
                            await fetchJSON<Kavita.SerieResponse[]>(tagRequest);

                        for (const manga of tagResult ?? []) {
                            if (
                                !titleSearchIds.includes(`${manga.id}`) &&
                                manga.name
                            ) {
                                titleSearchIds.push(`${manga.id}`);
                                titleSearchTiles.push({
                                    title: manga.name,
                                    imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${kavitaAPI}`,
                                    mangaId: `${manga.id}`,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Handle tag/filter-based search
        const { includeStatements, excludeStatements, includeCombination } =
            this.buildFilterStatements(query);

        const allStatements = [...includeStatements, ...excludeStatements];

        if (allStatements.length > 0) {
            const filterRequest: Request = {
                url: `${kavitaURL}/Series/all-v2?PageNumber=${page + 1}&PageSize=${pageSize}`,
                body: JSON.stringify({
                    id: 0,
                    name: "filter-tags",
                    statements: allStatements,
                    combination: includeCombination,
                    sortOptions: {
                        sortField: 1,
                        isAscending: true,
                    },
                    limitTo: 0,
                }),
                method: "POST",
            };

            const filterResult =
                await fetchJSON<Kavita.SerieResponse[]>(filterRequest);

            for (const manga of filterResult ?? []) {
                if (!manga.name) continue;
                tagSearchTiles.push({
                    title: manga.name,
                    imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${kavitaAPI}`,
                    mangaId: `${manga.id}`,
                });
            }

            // When we have both title and tag filters, intersect the results
            // When only tag filters, use tag results directly
            if (titleSearchTiles.length > 0 && tagSearchTiles.length > 0) {
                result = tagSearchTiles.filter((value) =>
                    titleSearchTiles.some(
                        (target) => target.mangaId === value.mangaId,
                    ),
                );
            } else if (tagSearchTiles.length > 0) {
                result = tagSearchTiles;
            } else {
                result = titleSearchTiles;
            }

            // Tag filter search already uses server-side pagination
            return {
                items: result,
                metadata: result.length >= pageSize
                    ? { offset: page + 1, collectedIds: metadata?.collectedIds }
                    : undefined,
            };
        }

        // Title-only search: client-side pagination
        result = titleSearchTiles;
        result = result.slice(page * pageSize, (page + 1) * pageSize);

        return {
            items: result,
            metadata: result.length >= pageSize
                ? { offset: page + 1, collectedIds: metadata?.collectedIds }
                : undefined,
        };
    }

    /**
     * Creates filter statements for person-based recursive search
     */
    createSearchQuery(
        value: string,
    ): Kavita.FilterStatementDto[] {
        const searchQuery: Kavita.FilterStatementDto[] = [];
        const personFields = [
            FILTER_FIELD.characters,
            FILTER_FIELD.publisher,
            FILTER_FIELD.editor,
            FILTER_FIELD.coverArtist,
            FILTER_FIELD.letterer,
            FILTER_FIELD.colorist,
            FILTER_FIELD.inker,
            FILTER_FIELD.penciller,
            FILTER_FIELD.writers,
        ];

        for (const field of personFields) {
            searchQuery.push({
                comparison: FILTER_COMPARISON.Contains,
                field: field,
                value: value,
            });
        }
        return searchQuery;
    }
}
