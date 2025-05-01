// TODO:
// - Add the English name to the title view
// - Add additional info to the title view
// - Make getChapterDetails only return new chapters
// - Fix exclude search

import {
    BasicRateLimiter,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    DiscoverSection,
    DiscoverSectionItem,
    DiscoverSectionProviding,
    Extension,
    Form,
    MangaProviding,
    PagedResults,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    SearchResultsProviding,
    SettingsFormProviding,
    SourceManga,
    TagSection,
    UpdateManager,
} from "@paperback/types";
import { SettingsForm } from "./forms/SettingsForm";
import { KavitaInterceptor } from "./KavitaInterceptor";
import { ChapterProvider } from "./providers/ChapterProvider";
import { DiscoverProvider } from "./providers/DiscoverProvider";
import { MangaProvider } from "./providers/MangaProvider";
import { SearchProvider } from "./providers/SearchProvider";

// Should match the capabilities which you defined in pbconfig.ts
type KavitaImplementation = SettingsFormProviding &
    Extension &
    DiscoverSectionProviding &
    SearchResultsProviding &
    MangaProviding &
    ChapterProviding;

// Main extension class
export class KavitaExtension implements KavitaImplementation {
    // Implementation of the main rate limiter
    mainRateLimiter = new BasicRateLimiter("main", {
        numberOfRequests: 15,
        bufferInterval: 10,
        ignoreImages: true,
    });

    // Implementation of the main interceptor
    mainInterceptor = new KavitaInterceptor("main");

    private mangaProvider: MangaProvider = new MangaProvider();
    private chapterProvider: ChapterProvider = new ChapterProvider();
    private searchProvider: SearchProvider = new SearchProvider();
    private discoverProvider: DiscoverProvider = new DiscoverProvider();

    // Method from the Extension interface which we implement, initializes the rate limiter, interceptor, discover sections and search filters
    async initialise(): Promise<void> {
        this.mainRateLimiter.registerInterceptor();
        this.mainInterceptor.registerInterceptor();

        if (Application.isResourceLimited) return;
    }

    // MangaProviding implementation
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        return this.mangaProvider.getMangaDetails(mangaId);
    }

    // Populate search filters
    async getSearchFilters(): Promise<SearchFilter[]> {
        return this.searchProvider.getSearchFilters();
    }

    // Populates search
    async getSearchResults(
        query: SearchQuery,
        metadata: Kavita.Metadata,
    ): Promise<PagedResults<SearchResultItem>> {
        return this.searchProvider.getSearchResults(query, metadata);
    }

    async getSearchTags(): Promise<TagSection[]> {
        return this.searchProvider.getSearchTags();
    }

    // ChapterProviding implementation
    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        return this.chapterProvider.getChapters(sourceManga);
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        return this.chapterProvider.getChapterDetails(chapter);
    }

    async processTitlesForUpdates(updateManager: UpdateManager): Promise<void> {
        return this.chapterProvider.processTitlesForUpdates(updateManager);
    }

    async getSettingsForm(): Promise<Form> {
        return new SettingsForm();
    }

    // DiscoverSectionProviding implementation
    async getDiscoverSections(): Promise<DiscoverSection[]> {
        return this.discoverProvider.getDiscoverSections();
    }

    async getDiscoverSectionItems(
        section: DiscoverSection,
        metadata: Kavita.Metadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        return this.discoverProvider.getDiscoverSectionItems(section, metadata);
    }
}

export const Kavita = new KavitaExtension();
