import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverProvider } from "../providers/DiscoverProvider";
import { SearchProvider } from "../providers/SearchProvider";
import { nextPageMetadata, pageFromMetadata } from "../utils/paging";

interface SentRequest {
    url: string;
    method?: string;
    body?: string;
}

let sent: SentRequest[];
// How many series the fake server holds, and which ones the name search finds
let total: number;
let nameMatches: number[];
let searchSeries: { seriesId: number; name: string }[];

function page(url: string): number[] {
    const number = parseInt(/PageNumber=(\d+)/.exec(url)?.[1] ?? "1");
    const size = parseInt(/PageSize=(\d+)/.exec(url)?.[1] ?? "50");
    const first = (number - 1) * size;
    const count = Math.max(0, Math.min(size, total - first));
    return Array.from({ length: count }, (_, i) => first + i + 1);
}

beforeEach(() => {
    sent = [];
    total = 0;
    nameMatches = [];
    searchSeries = [];
    vi.stubGlobal("Application", {
        getState: (key: string) =>
            ({
                kavita_url: "http://kavita",
                kavita_apikey: "key",
                kavita_page_size: "10",
            })[key],
        scheduleRequest: (request: SentRequest) => {
            sent.push(request);
            let payload: unknown;
            if (request.url.includes("/Search/search")) {
                payload = {
                    series: searchSeries,
                    persons: [],
                    genres: [],
                    tags: [],
                };
            } else if (request.url.includes("recently-updated-series")) {
                payload = page(request.url).map((id) => ({
                    seriesId: id,
                    seriesName: `S${id}`,
                    title: `Ch ${id}`,
                    chapterId: id,
                    created: "2024-01-01T00:00:00",
                }));
            } else if (
                request.body?.includes('"field":1,') &&
                request.url.includes("all-v2")
            ) {
                payload = nameMatches.map((id) => ({
                    id,
                    name: `Name ${id}`,
                    libraryId: 1,
                }));
            } else {
                payload = page(request.url).map((id) => ({
                    id,
                    name: `S${id}`,
                    libraryId: 1,
                }));
            }
            return Promise.resolve([{ status: 200 }, JSON.stringify(payload)]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("paging helpers", () => {
    it("tells when there is a next page", () => {
        expect(nextPageMetadata(10, 10, 1, undefined)).toEqual({
            offset: 1,
            collectedIds: undefined,
        });
        expect(nextPageMetadata(9, 10, 1, undefined)).toBeUndefined();
        expect(nextPageMetadata(0, 10, 3, undefined)).toBeUndefined();
    });

    it("asks the page after the one in the metadata", () => {
        expect(pageFromMetadata(undefined)).toBe(1);
        expect(pageFromMetadata({ offset: 1 })).toBe(2);
    });
});

/** Loads a section page after page, like Paperback does while scrolling */
async function loadAll(
    load: (metadata: Kavita.Metadata | undefined) => Promise<{
        items: { mangaId: string }[];
        metadata?: Kavita.Metadata;
    }>,
): Promise<string[]> {
    const ids: string[] = [];
    let metadata: Kavita.Metadata | undefined;
    for (let i = 0; i < 20; i++) {
        const result = await load(metadata);
        ids.push(...result.items.map((item) => item.mangaId));
        if (!result.metadata) break;
        metadata = result.metadata;
    }
    return ids;
}

describe("Discover sections load page after page", () => {
    const section = {
        id: "2",
        title: "Library",
        type: "prominentCarousel",
    } as never;

    it("a library", async () => {
        total = 34;
        const ids = await loadAll(
            (m) =>
                new DiscoverProvider().getLibrarySection(section, m) as never,
        );
        expect(ids).toHaveLength(34);
        expect(new Set(ids).size).toBe(34);
        // 10 + 10 + 10 + 4
        expect(sent).toHaveLength(4);
    });

    it("on deck", async () => {
        total = 23;
        const ids = await loadAll(
            (m) =>
                new DiscoverProvider().getMangaListDiscoverSectionItems(
                    section,
                    m,
                ) as never,
        );
        expect(ids).toHaveLength(23);
        expect(sent[1]?.url).toContain("PageNumber=2");
    });

    it("latest updates", async () => {
        total = 25;
        const ids = await loadAll(
            (m) =>
                new DiscoverProvider().getLatestUpdatesDiscoverSectionItems(
                    m,
                ) as never,
        );
        expect(ids).toHaveLength(25);
        expect(sent[0]?.url).toContain("PageSize=10");
    });

    it("recently added", async () => {
        total = 12;
        const ids = await loadAll(
            (m) =>
                new DiscoverProvider().getRecentlyAddedDiscoverSectionItems(
                    m,
                ) as never,
        );
        expect(ids).toHaveLength(12);
    });

    it("stops after a short page", async () => {
        total = 4;
        const result = await new DiscoverProvider().getLibrarySection(section);
        expect(result.items).toHaveLength(4);
        expect(result.metadata).toBeUndefined();
    });
});

describe("title search", () => {
    const query = { title: "Name", filters: [] } as never;

    it("is not limited to the 15 series of Search/search", async () => {
        searchSeries = Array.from({ length: 15 }, (_, i) => ({
            seriesId: i + 1,
            name: `Name ${i + 1}`,
        }));
        nameMatches = Array.from({ length: 34 }, (_, i) => i + 1);

        const first = await new SearchProvider().getSearchResults(query, {});
        expect(first.items).toHaveLength(10);
        // more pages are announced
        expect(first.metadata).toBeDefined();

        const all: string[] = [];
        let metadata = undefined as never;
        for (let i = 0; i < 10; i++) {
            const result = await new SearchProvider().getSearchResults(
                query,
                metadata,
            );
            all.push(
                ...result.items.map(
                    (item) => (item as { mangaId: string }).mangaId,
                ),
            );
            if (!result.metadata) break;
            metadata = result.metadata as never;
        }
        expect(all).toHaveLength(34);
        expect(new Set(all).size).toBe(34);
    });

    it("keeps the series Search/search found under another name", async () => {
        nameMatches = [1, 2];
        searchSeries = [
            { seriesId: 2, name: "Name 2" },
            { seriesId: 99, name: "Found by its original name" },
        ];
        const result = await new SearchProvider().getSearchResults(query, {});
        expect(
            result.items.map((i) => (i as { mangaId: string }).mangaId),
        ).toEqual(["1", "2", "99"]);
    });

    it("falls back to Search/search when the name filter fails", async () => {
        searchSeries = [{ seriesId: 5, name: "Name 5" }];
        const original = Application.scheduleRequest as unknown as (
            request: SentRequest,
        ) => Promise<unknown>;
        vi.stubGlobal("Application", {
            ...Application,
            scheduleRequest: (request: SentRequest) => {
                if (request.url.includes("all-v2"))
                    return Promise.resolve([{ status: 500 }, ""]);
                return original(request);
            },
        });
        const result = await new SearchProvider().getSearchResults(query, {});
        expect(
            result.items.map((i) => (i as { mangaId: string }).mangaId),
        ).toEqual(["5"]);
    });
});
