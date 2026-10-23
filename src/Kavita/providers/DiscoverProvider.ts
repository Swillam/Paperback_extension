import {
    DiscoverSection,
    DiscoverSectionItem,
    DiscoverSectionType,
    PagedResults,
    Request,
    Tag,
    TagSection,
} from "@paperback/types";
import {
    getDiscoverOrder,
    getKavitaApiKey,
    getKavitaPageSize,
    getKavitaPageSizeNumber,
    getKavitaUrl,
    isDiscoverSectionEnabled,
} from "../settings";
import { fetchJSON } from "../utils/CommonUtils";
import {
    FILTER_COMBINATION,
    FILTER_COMPARISON,
    FILTER_FIELD,
} from "../utils/filters";
import {
    parseSmartFilterSectionId,
    SERIES_ENTITY_TYPE,
    smartFilterSectionId,
} from "../utils/smartFilters";

/**
 * Provides manga discover sections and content for the home page
 */
export class DiscoverProvider {
    /**
     * Returns configured discover sections based on user settings
     */
    async getDiscoverSections(): Promise<DiscoverSection[]> {
        const builtIn: Record<string, DiscoverSection> = {
            ondeck: {
                id: "ondeck",
                title: "On Deck",
                type: DiscoverSectionType.featured,
            },
            latest_updates: {
                id: "latest_updates",
                title: "Latest Updates",
                type: DiscoverSectionType.chapterUpdates,
            },
            recently_added: {
                id: "recently_added",
                title: "Recently Added",
                type: DiscoverSectionType.simpleCarousel,
            },
            tag_sections: {
                id: "tag_sections",
                title: "Tag Sections",
                type: DiscoverSectionType.genres,
            },
        };

        const sections: DiscoverSection[] = [];

        // The groups come in the order chosen in the settings
        for (const group of getDiscoverOrder()) {
            if (!isDiscoverSectionEnabled(group)) continue;

            if (group === "libraries") {
                sections.push(...(await this.getLibrarySections()));
            } else if (group === "smart_filters") {
                sections.push(...(await this.getSmartFilterSections()));
            } else if (builtIn[group]) {
                sections.push(builtIn[group]);
            }
        }

        return sections;
    }

    /**
     * One carousel per library (book libraries are not supported)
     */
    private async getLibrarySections(): Promise<DiscoverSection[]> {
        const libraries = await fetchJSON<Kavita.AllLibraries>({
            url: `${getKavitaUrl()}/Library/libraries`,
            method: "GET",
        });

        return libraries
            .filter((library) => library.type !== 2)
            .map((library) => ({
                id: `${library.id}`,
                title: library.name,
                type: DiscoverSectionType.prominentCarousel,
            }));
    }

    /**
     * Creates tag sections from available manga tags
     */
    getTagSections(): DiscoverSection[] {
        const sections: DiscoverSection[] = [];
        const allTags = ["genres", "people", "tags"];
        for (const tag of allTags) {
            sections.push({
                id: tag,
                title: tag.charAt(0).toUpperCase() + tag.slice(1),
                type: DiscoverSectionType.genres,
            });
        }

        return sections;
    }

    /**
     * Gets items for tag-based discover sections
     */
    async getTags(
        section: DiscoverSection,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        const sections: Record<string, TagSection> = {};
        const allTags = ["genres", "people", "tags"];
        for (const tag of allTags) {
            if (sections[tag] == null) {
                sections[tag] = {
                    id: tag,
                    title: tag.charAt(0).toUpperCase() + tag.slice(1),
                    tags: [],
                };
            }
            const request = {
                url: `${getKavitaUrl()}/Metadata/${tag}`,
                method: "GET",
            };

            const json: Tag[] = [];
            if (tag === "people") {
                const result = await fetchJSON<Kavita.Contributor[]>(request);
                json.push(
                    ...result.map((x) => ({
                        id: `${x.id}`,
                        title: x.name,
                    })),
                );
            } else {
                const result = await fetchJSON<Tag[]>(request);
                json.push(...result);
            }

            sections[tag].tags = [...(sections[tag]?.tags ?? []), ...json];
        }

        return {
            items:
                sections[section.id]?.tags.map((x) => ({
                    type: "genresCarouselItem",
                    searchQuery: {
                        title: "",
                        filters: [
                            {
                                id: `tags-${section.id}`,
                                value: {
                                    [`${x.id}:${x.title}`]: "included",
                                },
                            },
                        ],
                    },
                    name: x.title,
                })) ?? [],
            metadata: undefined,
        };
    }

    /**
     * Fetches content for a specific discover section
     */
    async getDiscoverSectionItems(
        section: DiscoverSection,
        metadata: Kavita.Metadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        const sectionId = section.id;

        if (sectionId === "ondeck") {
            return this.getMangaListDiscoverSectionItems(section);
        }

        if (sectionId === "latest_updates") {
            return this.getLatestUpdatesDiscoverSectionItems();
        }

        if (sectionId === "recently_added") {
            return this.getRecentlyAddedDiscoverSectionItems(metadata);
        }

        if (sectionId === "tag_sections") {
            return this.getTags(section);
        }

        if (parseSmartFilterSectionId(sectionId) !== undefined) {
            return this.getSmartFilterSectionItems(section, metadata);
        }

        return this.getLibrarySection(section);
    }

    /**
     * One carousel per series smart filter saved by the user in Kavita
     */
    private async getSmartFilterSections(): Promise<DiscoverSection[]> {
        try {
            const filters = await fetchJSON<Kavita.SmartFilter[]>({
                url: `${getKavitaUrl()}/Filter`,
                method: "GET",
            });

            return filters
                .filter((filter) => filter.entityType === SERIES_ENTITY_TYPE)
                .map((filter) => ({
                    id: smartFilterSectionId(filter.id),
                    title: filter.name,
                    type: DiscoverSectionType.simpleCarousel,
                }));
        } catch (error) {
            // Older Kavita versions have no smart filters: keep the other sections
            console.log(`Could not load the smart filters: ${String(error)}`);
            return [];
        }
    }

    /**
     * Runs a smart filter saved in Kavita
     */
    async getSmartFilterSectionItems(
        section: DiscoverSection,
        metadata: Kavita.Metadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        const kavitaURL = getKavitaUrl();
        const filterId = parseSmartFilterSectionId(section.id);
        if (filterId === undefined) {
            throw new Error(`Unknown smart filter section: ${section.id}`);
        }

        const filters = await fetchJSON<Kavita.SmartFilter[]>({
            url: `${kavitaURL}/Filter`,
            method: "GET",
        });
        const smartFilter = filters.find((filter) => filter.id === filterId);
        if (!smartFilter) {
            throw new Error(
                `The smart filter "${section.title}" no longer exists`,
            );
        }

        // Kavita stores the filter encoded in a string: decode it into a filter DTO
        const decoded = await fetchJSON<object>({
            url: `${kavitaURL}/Filter/decode`,
            method: "POST",
            body: JSON.stringify({ encodedFilter: smartFilter.filter }),
        });

        const pageSize = getKavitaPageSizeNumber();
        const page = (metadata?.offset ?? 0) + 1;
        const series = await fetchJSON<Kavita.SerieResponse[]>({
            url: `${kavitaURL}/Series/all-v2?PageNumber=${page}&PageSize=${pageSize}`,
            method: "POST",
            body: JSON.stringify(decoded),
        });

        const apiKey = getKavitaApiKey();
        return {
            items: series.map((manga) => ({
                type: "simpleCarouselItem",
                mangaId: `${manga.id}`,
                title: manga.name,
                imageUrl: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${apiKey}`,
            })),
            metadata:
                series.length >= pageSize
                    ? { offset: page, collectedIds: metadata?.collectedIds }
                    : undefined,
        };
    }

    /**
     * Fetches content for a specific library section
     */
    async getLibrarySection(
        section: DiscoverSection,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        const kavitaURL = getKavitaUrl();
        const pageSize = getKavitaPageSize();

        const request: Request = {
            // The libraryId query parameter is ignored by Kavita: filter with a statement
            url: `${kavitaURL}/Series/all-v2?PageNumber=1&PageSize=${pageSize}`,
            body: JSON.stringify({
                id: 0,
                name: "all",
                statements: [
                    {
                        comparison: FILTER_COMPARISON.Equal,
                        field: FILTER_FIELD.libraries,
                        value: section.id,
                    },
                ],
                combination: FILTER_COMBINATION.And,
                sortOptions: {
                    sortField: 1,
                    isAscending: true,
                },
                limitTo: 0,
            }),
            method: "POST",
        };

        const json = await fetchJSON<Kavita.SerieResponse[]>(request);
        if (json === undefined) {
            throw new Error(`Failed to create results for ${section.title}`);
        }

        const mangas = json;

        if (mangas.length === 0) {
            return { items: [], metadata: undefined };
        }
        return {
            items: mangas.map((x) => ({
                type: "prominentCarouselItem",
                imageUrl: `${kavitaURL}/image/series-cover?seriesId=${x.id}&apiKey=${getKavitaApiKey()}`,
                mangaId: `${x.id}`,
                title: x.name,
                supertitle: undefined,
                metadata: undefined,
            })),
            metadata: undefined,
        };
    }

    async getMangaListDiscoverSectionItems(
        section: DiscoverSection,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        const kavitaURL = getKavitaUrl();
        const pageSize = getKavitaPageSize();

        const request = {
            url: `${kavitaURL}/Series/on-deck?PageNumber=1&PageSize=${pageSize}`,
            method: "POST",
        };
        const json = await fetchJSON<Kavita.SerieResponse[]>(request);
        if (json === undefined) {
            throw new Error(`Failed to create results for ${section.title}`);
        }

        return {
            items: json.map((x) => ({
                type: "featuredCarouselItem",
                imageUrl: `${kavitaURL}/image/series-cover?seriesId=${x.id}&apiKey=${getKavitaApiKey()}`,
                mangaId: `${x.id}`,
                title: x.name,
                supertitle: undefined,
                metadata: undefined,
            })),
            metadata: undefined,
        };
    }

    /**
     * Fetches latest chapter updates for the updates section
     */
    async getLatestUpdatesDiscoverSectionItems(): Promise<
        PagedResults<DiscoverSectionItem>
    > {
        const kavitaURL = getKavitaUrl();

        const chapterRequest = {
            url: `${kavitaURL}/Series/recently-updated-series`,
            method: "POST",
        };

        const series =
            await fetchJSON<Kavita.RecentlyUpdatedResponse[]>(chapterRequest);

        const nextMetadata = undefined;

        const items: DiscoverSectionItem[] = [];
        for (const serie of series) {
            const mangaId = serie.seriesId;

            const image = `${kavitaURL}/image/series-cover?seriesId=${mangaId}&apiKey=${getKavitaApiKey()}`;
            const title = serie.seriesName;
            const subtitle = serie.title;
            items.push({
                chapterId: `${serie.chapterId}`,
                mangaId: `${mangaId}`,
                title: title,
                subtitle: subtitle,
                imageUrl: image,
                publishDate: new Date(serie.created),
                type: "chapterUpdatesCarouselItem",
            });
        }

        return {
            items: items,
            metadata: nextMetadata,
        };
    }

    /**
     * Fetches recently added manga for display
     */
    async getRecentlyAddedDiscoverSectionItems(
        metadata: Kavita.Metadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        const kavitaURL = getKavitaUrl();
        const kavitaAPI = getKavitaApiKey();
        const pageSize = getKavitaPageSize();
        const offset: number = (metadata?.offset ?? 0) + 1;
        const collectedIds: string[] = metadata?.collectedIds ?? [];

        const request = {
            url: `${kavitaURL}/Series/recently-added-v2?PageNumber=${offset}&PageSize=${pageSize}`,
            body: JSON.stringify({
                id: 0,
                name: "all",
                combination: 0,
                sortOptions: {
                    sortField: 1,
                    isAscending: true,
                },
                limitTo: 0,
            }),
            method: "POST",
        };

        const json = await fetchJSON<Kavita.SerieResponse[]>(request);

        const items: DiscoverSectionItem[] = [];
        for (const manga of json) {
            const mangaId = manga.id;
            const title = manga.name;
            const image = `${kavitaURL}/image/series-cover?seriesId=${mangaId}&apiKey=${kavitaAPI}`;
            items.push({
                mangaId: `${mangaId}`,
                title: title,
                imageUrl: image,
                type: "simpleCarouselItem",
            });
        }
        const nextMetadata: Kavita.Metadata | undefined =
            items.length < parseInt(pageSize)
                ? undefined
                : { offset: offset, collectedIds };
        return {
            items: items,
            metadata: nextMetadata,
        };
    }
}
