import {
    Chapter,
    ChapterDetails,
    ChapterProviding,
    ChapterReadActionQueueProcessingResult,
    DiscoverSection,
    DiscoverSectionItem,
    DiscoverSectionProviding,
    Extension,
    Form,
    ManagedCollection,
    ManagedCollectionChangeset,
    ManagedCollectionProviding,
    MangaProgress,
    MangaProgressProviding,
    MangaProviding,
    PagedResults,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    SearchResultsProviding,
    SettingsFormProviding,
    SortingOption,
    SourceManga,
    TagSection,
    TrackedMangaChapterReadAction,
    UpdateManager,
} from "@paperback/types";
import { SettingsForm } from "./forms/SettingsForm";
import { KavitaInterceptor } from "./KavitaInterceptor";
import { KavitaRateLimiter } from "./KavitaRateLimiter";
import { ChapterProvider } from "./providers/ChapterProvider";
import { CollectionProvider } from "./providers/CollectionProvider";
import { DiscoverProvider } from "./providers/DiscoverProvider";
import { MangaProvider } from "./providers/MangaProvider";
import { ProgressProvider } from "./providers/ProgressProvider";
import { SearchProvider } from "./providers/SearchProvider";

// Should match the capabilities which you defined in pbconfig.ts
type KavitaImplementation = SettingsFormProviding &
    Extension &
    DiscoverSectionProviding &
    SearchResultsProviding &
    MangaProviding &
    ChapterProviding &
    MangaProgressProviding &
    ManagedCollectionProviding;

// Main extension class
export class KavitaExtension implements KavitaImplementation {
    // Implementation of the main rate limiter
    mainRateLimiter = new KavitaRateLimiter("main", {
        numberOfRequests: 15,
        bufferInterval: 10,
        ignoreImages: true,
    });

    // Implementation of the main interceptor
    mainInterceptor = new KavitaInterceptor("main");

    private mangaProvider: MangaProvider = new MangaProvider();
    private chapterProvider: ChapterProvider = new ChapterProvider();
    private searchProvider: SearchProvider = new SearchProvider();
    private collectionProvider: CollectionProvider = new CollectionProvider();
    private discoverProvider: DiscoverProvider = new DiscoverProvider();
    private progressProvider: ProgressProvider = new ProgressProvider(
        this.chapterProvider,
    );

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
        sortingOption?: SortingOption,
    ): Promise<PagedResults<SearchResultItem>> {
        return this.searchProvider.getSearchResults(
            query,
            metadata,
            sortingOption,
        );
    }

    async getSortingOptions(): Promise<SortingOption[]> {
        return this.searchProvider.getSortingOptions();
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

    // MangaProgressProviding implementation
    async getMangaProgressManagementForm(
        sourceManga: SourceManga,
    ): Promise<Form> {
        return this.progressProvider.getMangaProgressManagementForm(
            sourceManga,
        );
    }

    async getMangaProgress(
        sourceManga: SourceManga,
    ): Promise<MangaProgress | undefined> {
        return this.progressProvider.getMangaProgress(sourceManga);
    }

    async processChapterReadActionQueue(
        actions: TrackedMangaChapterReadAction[],
    ): Promise<ChapterReadActionQueueProcessingResult> {
        return this.progressProvider.processChapterReadActionQueue(actions);
    }

    // ManagedCollectionProviding implementation
    async getManagedLibraryCollections(): Promise<ManagedCollection[]> {
        return this.collectionProvider.getManagedLibraryCollections();
    }

    async getSourceMangaInManagedCollection(
        managedCollection: ManagedCollection,
    ): Promise<SourceManga[]> {
        return this.collectionProvider.getSourceMangaInManagedCollection(
            managedCollection,
        );
    }

    async commitManagedCollectionChanges(
        changeset: ManagedCollectionChangeset,
    ): Promise<void> {
        return this.collectionProvider.commitManagedCollectionChanges(
            changeset,
        );
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
