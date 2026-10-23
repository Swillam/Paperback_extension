import {
    PagedResults,
    Request,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    SortingOption,
    Tag,
    TagSection,
} from "@paperback/types";
import {
    getKavitaApiKey,
    getKavitaEnableRecursiveSearch,
    getKavitaPageSizeNumber,
    getKavitaUrl,
} from "../settings";
import { fetchJSON } from "../utils/CommonUtils";
import {
    ANY_VALUE,
    buildFilterPlan,
    FILTER_COMBINATION,
    FILTER_COMPARISON,
    FILTER_FIELD,
    PUBLICATION_STATUS_OPTIONS,
    READ_STATE_OPTIONS,
    type FilterGroup,
} from "../utils/filters";
import { getSortingOptionList, kavitaSortFor } from "../utils/sorting";

// Upper bound when fetching the series to remove from a tag search
const MAX_EXCLUDED_SERIES = 1000;

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
            const libraryParam =
                includeLibraryIds.length > 0
                    ? `?libraryIds=${includeLibraryIds.join(",")}`
                    : "";
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

        const libraries = await fetchJSON<Kavita.AllLibraries>({
            url: `${getKavitaUrl()}/Library/libraries`,
            method: "GET",
        });
        filters.push({
            id: "library",
            type: "dropdown",
            options: [
                { id: ANY_VALUE, value: "Any" },
                ...libraries
                    .filter((library) => library.type !== 2)
                    .map((library) => ({
                        id: `${library.id}`,
                        value: library.name,
                    })),
            ],
            value: ANY_VALUE,
            title: "Library",
        });
        filters.push({
            id: "status",
            type: "dropdown",
            options: [
                { id: ANY_VALUE, value: "Any" },
                ...PUBLICATION_STATUS_OPTIONS,
            ],
            value: ANY_VALUE,
            title: "Publication Status",
        });
        filters.push({
            id: "readState",
            type: "dropdown",
            options: [{ id: ANY_VALUE, value: "Any" }, ...READ_STATE_OPTIONS],
            value: ANY_VALUE,
            title: "Read State",
        });

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

    async getSortingOptions(): Promise<SortingOption[]> {
        return getSortingOptionList();
    }

    /**
     * Executes manga search with filters and returns results
     */
    async getSearchResults(
        query: SearchQuery,
        metadata: Kavita.Metadata,
        sortingOption?: SortingOption,
    ): Promise<PagedResults<SearchResultItem>> {
        const sort = kavitaSortFor(sortingOption?.id);
        const kavitaAPI = getKavitaApiKey();
        const kavitaURL = getKavitaUrl();
        const pageSize: number = getKavitaPageSizeNumber();
        const enableRecursiveSearch = getKavitaEnableRecursiveSearch();
        const page: number = metadata?.offset ?? 0;

        const titleSearchIds: string[] = [];

        const tagSearchTiles: SearchResultItem[] = [];
        const titleSearchTiles: SearchResultItem[] = [];

        let result: SearchResultItem[];

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
                    // Kavita filters people by id, not by name
                    const personId = (person as unknown as { id: number }).id;
                    if (!personId) continue;

                    const personRequest: Request = {
                        url: `${kavitaURL}/Series/all-v2?PageNumber=1&PageSize=${pageSize}`,
                        body: JSON.stringify({
                            id: 0,
                            name: "filter-persons",
                            statements: this.createSearchQuery(`${personId}`),
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
                        // Kavita filters genres and tags by id, not by title
                        const tagId = (item as Kavita.Genre).id;
                        if (!tagId) continue;

                        const tagRequest: Request = {
                            url: `${kavitaURL}/Series/all-v2?PageNumber=1&PageSize=${pageSize}`,
                            body: JSON.stringify({
                                id: 0,
                                name: `filter-${tagName}`,
                                statements: [
                                    {
                                        comparison: FILTER_COMPARISON.Contains,
                                        field: FILTER_FIELD[
                                            tagName as keyof typeof FILTER_FIELD
                                        ],
                                        value: `${tagId}`,
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
        let plan = buildFilterPlan(query);

        // Nothing typed and nothing selected: browse the whole library with the chosen sort
        if (
            !plan.main &&
            (typeof query.title !== "string" || query.title === "")
        ) {
            plan = {
                main: { statements: [], combination: FILTER_COMBINATION.And },
                excluded: undefined,
                required: undefined,
            };
        }

        if (plan.main) {
            const filterResult = await this.runFilter(
                plan.main,
                page,
                pageSize,
                sort,
            );

            // Series that must be removed (include/exclude operators that
            // Kavita cannot combine in a single request)
            const excludedIds = new Set<string>();
            if (plan.excluded) {
                const excludedResult = await this.runFilter(
                    plan.excluded,
                    0,
                    MAX_EXCLUDED_SERIES,
                    sort,
                );
                for (const manga of excludedResult)
                    excludedIds.add(`${manga.id}`);
            }

            // Series that must also match the dropdown filters
            let requiredIds: Set<string> | undefined;
            if (plan.required) {
                const requiredResult = await this.runFilter(
                    plan.required,
                    0,
                    MAX_EXCLUDED_SERIES,
                    sort,
                );
                requiredIds = new Set(requiredResult.map((m) => `${m.id}`));
            }

            for (const manga of filterResult) {
                if (!manga.name || excludedIds.has(`${manga.id}`)) continue;
                if (requiredIds && !requiredIds.has(`${manga.id}`)) continue;
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

            // Tag filter search already uses server-side pagination: decide on
            // the next page from what the server returned, before removals
            return {
                items: result,
                metadata:
                    filterResult.length >= pageSize
                        ? {
                              offset: page + 1,
                              collectedIds: metadata?.collectedIds,
                          }
                        : undefined,
            };
        }

        // Title-only search: client-side pagination
        result = titleSearchTiles;
        result = result.slice(page * pageSize, (page + 1) * pageSize);

        return {
            items: result,
            metadata:
                result.length >= pageSize
                    ? { offset: page + 1, collectedIds: metadata?.collectedIds }
                    : undefined,
        };
    }

    /**
     * Runs a filter request against Kavita (server-side pagination, 0-based page)
     */
    private async runFilter(
        group: FilterGroup,
        page: number,
        pageSize: number,
        sort: { sortField: number; isAscending: boolean },
    ): Promise<Kavita.SerieResponse[]> {
        const request: Request = {
            url: `${getKavitaUrl()}/Series/all-v2?PageNumber=${page + 1}&PageSize=${pageSize}`,
            body: JSON.stringify({
                id: 0,
                name: "filter-tags",
                statements: group.statements,
                combination: group.combination,
                sortOptions: sort,
                limitTo: 0,
            }),
            method: "POST",
        };

        return (await fetchJSON<Kavita.SerieResponse[]>(request)) ?? [];
    }

    /**
     * Creates filter statements for person-based recursive search
     */
    createSearchQuery(value: string): Kavita.FilterStatementDto[] {
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
