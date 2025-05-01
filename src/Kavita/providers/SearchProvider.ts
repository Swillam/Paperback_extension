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
import { fetchJSON, KAVITA_PERSON_ROLES } from "../utils/CommonUtils";

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
            const request = {
                url: `${kavitaURL}/Metadata/${tagName}`,
                param: `?libraryIds=${includeLibraryIds.join(",")}`,
                method: "GET",
            };
            const result = await fetchJSON<Kavita.Genre[]>(request);
            const names: string[] = [];
            const tags: Tag[] = [];

            result.forEach((item: Kavita.Genre) => {
                switch (tagName) {
                    case "people":
                        if (!names.includes(item.title)) {
                            names.push(item.title);
                            tags.push({
                                id: `${tagName}-${item.id}`,
                                title: item.title,
                            });
                        }
                        break;
                    default:
                        tags.push({
                            id: `${tagName}-${item.id}`,
                            title: item.title,
                        });
                }
            });

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

        if (typeof query.title === "string" && query.title !== "") {
            const titleRequest = {
                url: `${kavitaURL}/Search/search`,
                param: `?queryString=${encodeURIComponent(query.title)}`,
                method: "GET",
            };

            // We don't want to throw if the server is unavailable
            const titleResult =
                await fetchJSON<Kavita.SearchResponse>(titleRequest);

            for (const manga of titleResult.series) {
                titleSearchIds.push(`${manga.seriesId}`);
                titleSearchTiles.push({
                    title: manga.name,
                    imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.seriesId}&apiKey=${kavitaAPI}`,
                    mangaId: `${manga.seriesId}`,
                    subtitle: undefined,
                });
            }

            if (enableRecursiveSearch) {
                const tagNames: (keyof Kavita.SearchResponse)[] = [
                    "persons",
                    "genres",
                    "tags",
                ];

                for (const tagName of tagNames) {
                    for (const item of titleResult[tagName]) {
                        let titleTagRequest: Request;
                        switch (tagName) {
                            case "persons":
                                titleTagRequest = {
                                    url: `${kavitaURL}/Series/all-v2`,
                                    body: JSON.stringify({
                                        [KAVITA_PERSON_ROLES[
                                            (item as Kavita.Contributor).malId
                                        ]]: [(item as Kavita.Contributor).id],
                                    }),
                                    method: "POST",
                                };
                                break;
                            default:
                                titleTagRequest = {
                                    url: `${kavitaURL}/Series/all-v2`,
                                    body: JSON.stringify({
                                        [tagName]: [(item as Tag).id],
                                    }),
                                    method: "POST",
                                };
                        }

                        const titleTagResult =
                            await fetchJSON<Kavita.SerieResponse[]>(
                                titleTagRequest,
                            );

                        for (const manga of titleTagResult) {
                            if (!titleSearchIds.includes(`${manga.id}`)) {
                                titleSearchIds.push(`${manga.id}`);
                                titleSearchTiles.push({
                                    title: manga.name,
                                    imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${kavitaAPI}`,
                                    mangaId: `${manga.id}`,
                                    subtitle: undefined,
                                });
                            }
                        }
                    }
                }
            }
        }

        result =
            tagSearchTiles.length > 0 && titleSearchTiles.length > 0
                ? tagSearchTiles.filter((value) =>
                      titleSearchTiles.some(
                          (target) => target.imageUrl === value.imageUrl,
                      ),
                  )
                : titleSearchTiles.concat(tagSearchTiles);

        result = result.slice(page * pageSize, (page + 1) * pageSize);

        return {
            items: result,
            metadata: { offset: page + 1, collectedIds: metadata.collectedIds },
        };
    }
}
