import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionProvider } from "../providers/CollectionProvider";
import { DiscoverProvider } from "../providers/DiscoverProvider";
import { MangaProvider } from "../providers/MangaProvider";
import { SearchProvider } from "../providers/SearchProvider";
import { coverUrl, isImageRequest } from "../utils/images";

// The test Paperback itself applies to know whether a url is an image
// (BasicRateLimiter.imageRegex); its image loader skipped the covers without it
const LOOKS_LIKE_AN_IMAGE = /\.(png|gif|jpeg|jpg|webp)(\?|$)/i;

describe("coverUrl", () => {
    it("ends with an image extension, as Paperback requires to load it", () => {
        const url = coverUrl("https://kavita/api", 42, "key");
        expect(url).toMatch(LOOKS_LIKE_AN_IMAGE);
        expect(url.endsWith(".png")).toBe(true);
    });

    it("keeps the series and the API key in the query", () => {
        const url = new URL(coverUrl("https://kavita/api", 42, "my-key"));
        expect(url.pathname).toBe("/api/image/series-cover");
        expect(url.searchParams.get("seriesId")).toBe("42");
        expect(url.searchParams.get("apiKey")).toBe("my-key");
    });

    it("is still recognised as an image carrying its key", () => {
        expect(isImageRequest(coverUrl("https://kavita/api", 1, "key"))).toBe(
            true,
        );
    });
});

// What the providers hand to Paperback
describe("covers returned by the providers", () => {
    let state: Record<string, unknown>;

    beforeEach(() => {
        state = {
            kavita_url: "https://kavita",
            kavita_apikey: "key",
            kavita_page_size: "10",
        };
        vi.stubGlobal("Application", {
            getState: (k: string) => state[k],
            scheduleRequest: (request: { url: string }) => {
                let payload: unknown = [
                    { id: 7, name: "Series", libraryId: 1, seriesId: 7 },
                ];
                if (
                    request.url.includes("/Series/7") ||
                    request.url.includes("Series/metadata")
                ) {
                    payload = {
                        id: 7,
                        name: "Series",
                        libraryId: 1,
                        summary: "",
                        genres: [],
                        tags: [],
                        writers: [],
                        pencillers: [],
                        publicationStatus: 0,
                        originalName: "",
                        localizedName: "",
                        sortName: "",
                    };
                }
                if (request.url.includes("/Search/search")) {
                    payload = {
                        series: [{ seriesId: 7, name: "Series" }],
                        persons: [],
                        genres: [],
                        tags: [],
                    };
                }
                if (request.url.includes("recently-updated-series")) {
                    payload = [
                        {
                            seriesId: 7,
                            seriesName: "Series",
                            title: "Ch 1",
                            chapterId: 1,
                            created: "2024-01-01T00:00:00",
                        },
                    ];
                }
                return Promise.resolve([
                    { status: 200 },
                    JSON.stringify(payload),
                ]);
            },
            arrayBufferToUTF8String: (buffer: string) => buffer,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const ratings = (items: unknown[]): unknown[] =>
        items.map((item) => (item as { contentRating?: string }).contentRating);

    const imageUrls = (items: unknown[]): string[] =>
        items.map((item) => (item as { imageUrl: string }).imageUrl);

    it("recently added, on deck, latest updates and libraries", async () => {
        const provider = new DiscoverProvider();
        const section = {
            id: "1",
            title: "Manga",
            type: "prominentCarousel",
        } as never;
        const lists = [
            (await provider.getRecentlyAddedDiscoverSectionItems(undefined))
                .items,
            (await provider.getMangaListDiscoverSectionItems(section)).items,
            (await provider.getLatestUpdatesDiscoverSectionItems()).items,
            (await provider.getLibrarySection(section)).items,
        ];
        for (const items of lists) {
            expect(items.length).toBeGreaterThan(0);
            for (const url of imageUrls(items))
                expect(url).toMatch(LOOKS_LIKE_AN_IMAGE);
            // Paperback hides the covers of the carousel items without a content rating
            expect(ratings(items)).toEqual(items.map(() => "SAFE"));
        }
    });

    it("search results", async () => {
        const result = await new SearchProvider().getSearchResults(
            { title: "Series", filters: [] },
            {},
        );
        expect(result.items.length).toBeGreaterThan(0);
        for (const url of imageUrls(result.items))
            expect(url).toMatch(LOOKS_LIKE_AN_IMAGE);
        expect(ratings(result.items)).toEqual(result.items.map(() => "SAFE"));
    });

    it("the series page", async () => {
        const manga = await new MangaProvider().getMangaDetails("7");
        expect(manga.mangaInfo.thumbnailUrl).toMatch(LOOKS_LIKE_AN_IMAGE);
    });

    it("the library collections", async () => {
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection({
                id: "want-to-read",
                title: "x",
            });
        expect(mangas.length).toBeGreaterThan(0);
        for (const manga of mangas)
            expect(manga.mangaInfo.thumbnailUrl).toMatch(LOOKS_LIKE_AN_IMAGE);
    });
});
