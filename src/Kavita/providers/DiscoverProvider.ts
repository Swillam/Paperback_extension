import {
    DiscoverSection,
    DiscoverSectionItem,
    DiscoverSectionType,
    PagedResults,
    Request,
    Tag,
    TagSection,
} from "@paperback/types";
import { getKavitaApiKey, getKavitaPageSize, getKavitaUrl } from "../settings";
import { fetchJSON } from "../utils/CommonUtils";

/**
 * Provides manga discover sections and content for the home page
 */
export class DiscoverProvider {
    /**
     * Returns configured discover sections based on user settings
     */
    async getDiscoverSections(): Promise<DiscoverSection[]> {
        const kavitaURL = getKavitaUrl();
        const sections: DiscoverSection[] = [
            {
                id: "ondeck",
                title: "On Deck",
                type: DiscoverSectionType.featured,
            },
            {
                id: "latest_updates",
                title: "Latest Updates",
                type: DiscoverSectionType.chapterUpdates,
            },
            {
                id: "recently_added",
                title: "Recently Added",
                type: DiscoverSectionType.simpleCarousel,
            },
            {
                id: "tag_sections",
                title: "Tag Sections",
                type: DiscoverSectionType.genres,
            },
        ];

        const request = {
            url: `${kavitaURL}/Library/libraries`,
            method: "GET",
        };

        const result = await fetchJSON<Kavita.AllLibraries>(request);

        for (const library of result) {
            if (library.type === 2) {
                continue;
            }

            sections.push({
                id: `${library.id}`,
                title: library.name,
                type: DiscoverSectionType.prominentCarousel,
            });
        }

        return sections;
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
                                value: { [x.id]: "included" },
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

        return this.getLibrarySection(section);
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
            url: `${kavitaURL}/Series/all-v2?libraryId=${section.id}&PageNumber=1&PageSize=${pageSize}`,
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
        if (json === undefined) {
            throw new Error(`Failed to create results for ${section.title}`);
        }

        return {
            items: json.map((x) => ({
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
            url: `${kavitaURL}/Series/recently-added-v2?PageNumber=1&PageSize=${pageSize}`,
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
            items.length < 100 ? undefined : { offset: offset, collectedIds };
        return {
            items: items,
            metadata: nextMetadata,
        };
    }
}
