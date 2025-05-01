import {
	PartialSourceManga,
    PagedResults,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    TagSection,
    Tag,
    URL,
} from "@paperback/types";

import { fetchJSON } from "../utils/CommonUtils";
import { getKavitaApiKey, getKavitaEnableRecursiveSearch, getKavitaPageSize, getKavitaUrl } from "../settings";
import { KAVITA_PERSON_ROLES } from "../utils/CommonUtils";

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
            method: 'GET',
        };

        const libraryResult = await fetchJSON<Kavita.AllLibraries>(libraryRequest);

        for (const library of libraryResult) {
            if (library.type === 2) continue;
            includeLibraryIds.push(library.id);
        }

        const tagNames: string[] = ['genres', 'people', 'tags'];
        const tagSections: any = [];

        for (const tagName of tagNames) {
            const request = {
                url: `${kavitaURL}/Metadata/${tagName}`,
                param: `?libraryIds=${includeLibraryIds.join(',')}`,
                method: 'GET',
            };
            const result = await fetchJSON<any>(request);
            const names: string[] = [];
            const tags: Tag[] = [];

            result.forEach(async (item: any) => {
                switch (tagName) {
                    case 'people':
                        if (!names.includes(item.name)) {
                            names.push(item.name);
                            tags.push({id: `${tagName}-${item.role}.${item.id}`, label: item.name})
                        }
                        break;
                    default:
                        tags.push({id: `${tagName}-${item.id}`, label: item.title})
                }
            });

            tagSections[tagName] ={
                id: tagName,
                label: tagName,
                tags: tags
            };
        }

        return tagNames.map((tag) => tagSections[tag]);
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
        const pageSize:number = +getKavitaPageSize();
        const enableRecursiveSearch = getKavitaEnableRecursiveSearch();
        const page: number = metadata?.page ?? 0;

        const titleSearchIds: string[] = [];

        const tagSearchTiles: PartialSourceManga[] = [];
        const titleSearchTiles: PartialSourceManga[] = [];

        let result: any

        if (typeof query.title === 'string' && query.title !== '') {			
            const titleRequest = {
                url: `${kavitaURL}/Search/search`,
                param: `?queryString=${encodeURIComponent(query.title)}`,
                method: 'GET'
            };

            // We don't want to throw if the server is unavailable
            const titleResult = await fetchJSON<any>(titleRequest);

            for (const manga of titleResult.series) {

                titleSearchIds.push(manga.seriesId);
                titleSearchTiles.push({
                        title: manga.name,
                        image: `${kavitaURL}/image/series-cover?seriesId=${manga.seriesId}&apiKey=${kavitaAPI}`,
                        mangaId: `${manga.seriesId}`,
                        subtitle: undefined
                });
            }

            if (enableRecursiveSearch) {
                const tagNames: string[] = ['persons', 'genres', 'tags'];

                for (const tagName of tagNames) {
                    for (const item of titleResult[tagName]) {
                        let titleTagRequest: any;
                        switch (tagName) {
                            case 'persons':
                                titleTagRequest = {
                                    url: `${kavitaURL}/Series/all`,
                                    data: JSON.stringify({[KAVITA_PERSON_ROLES[item.role]]: [item.id]}),
                                    method: 'POST'
                                };
                                break;
                            default:
                                titleTagRequest = {
                                    url: `${kavitaURL}/Series/all`,
                                    data: JSON.stringify({[tagName]: [item.id]}),
                                    method: 'POST'
                                };
                        }

                        const titleTagResult = await fetchJSON<any>(titleTagRequest);

                        for (const manga of titleTagResult) {
                            if (!titleSearchIds.includes(manga.id)) {
                                titleSearchIds.push(manga.id);
                                titleSearchTiles.push({
                                        title: manga.name,
                                        image: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${kavitaAPI}`,
                                        mangaId: `${manga.id}`,
                                        subtitle: undefined
                                    });
                            }
                        }
                    }
                }
            }
        }

        if (typeof query.includedTags !== 'undefined') {
            const body: any = {};
            const peopleTags: string[] = [];

            query.includedTags.forEach(async (tag) => {
                switch (tag.id.split('-')[0]) {
                    case 'people':
                        peopleTags.push(tag.label);
                        break;
                    default:
                        body[tag.id.split('-')[0] ?? ''] = body[tag.id.split('-')[0] ?? ''] ?? []
                        body[tag.id.split('-')[0] ?? ''].push(parseInt(tag.id.split('-')[1] ?? '0'));
                }
            });

            const peopleRequest = {
                url: `${kavitaURL}/Metadata/people`,
                method: 'GET'
            };

            const peopleResult = await fetchJSON<any>(peopleRequest);

            for (const people of peopleResult) {
                if (peopleTags.includes(people.name)) {
                    body[KAVITA_PERSON_ROLES[people.role]] = body[KAVITA_PERSON_ROLES[people.role]] ?? [];
                    body[KAVITA_PERSON_ROLES[people.role]].push(people.id);
                }
            }
            
            const tagRequst = {
                url: `${kavitaURL}/Series/all`,
                data: JSON.stringify(body),
                method: 'POST'
            };

            const tagResult = await fetchJSON<any>(tagRequst);

            for (const manga of tagResult) {
                tagSearchTiles.push({
                        title: manga.name,
                        image: `${kavitaURL}/image/series-cover?seriesId=${manga.id}&apiKey=${kavitaAPI}`,
                        mangaId: `${manga.id}`,
                        subtitle: undefined
                    });
            }
        }

        result = (tagSearchTiles.length > 0 && titleSearchTiles.length > 0) ? tagSearchTiles.filter((value) => titleSearchTiles.some((target) => target.image === value.image)) : titleSearchTiles.concat(tagSearchTiles)
    

        result = result.slice(page * pageSize, (page + 1) * pageSize);
        metadata = result.length === 0 ? undefined : { page: page + 1 };

        return {
            results: result,
            metadata: metadata
        };
    }
}