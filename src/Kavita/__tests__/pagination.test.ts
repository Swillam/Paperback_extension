import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionProvider } from "../providers/CollectionProvider";
import { DiscoverProvider } from "../providers/DiscoverProvider";

interface SentRequest {
    url: string;
    method?: string;
}

let sent: SentRequest[];
// How many series the fake server holds
let total: number;

function seriesPage(
    url: string,
): { id: number; name: string; libraryId: number }[] {
    const page = parseInt(/PageNumber=(\d+)/.exec(url)?.[1] ?? "1");
    const size = parseInt(/PageSize=(\d+)/.exec(url)?.[1] ?? "50");
    const first = (page - 1) * size;
    const count = Math.max(0, Math.min(size, total - first));
    return Array.from({ length: count }, (_, i) => ({
        id: first + i + 1,
        name: `Series ${first + i + 1}`,
        libraryId: 1,
    }));
}

beforeEach(() => {
    sent = [];
    total = 0;
    vi.stubGlobal("Application", {
        getState: (key: string) =>
            ({
                kavita_url: "http://kavita",
                kavita_apikey: "key",
                kavita_page_size: "40",
            })[key],
        scheduleRequest: (request: SentRequest) => {
            sent.push(request);
            return Promise.resolve([
                { status: 200 },
                JSON.stringify(seriesPage(request.url)),
            ]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("collection pagination", () => {
    const collection = (id: string) => ({ id, title: "x" });

    it("reads every page of Want to Read", async () => {
        total = 250;
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection(
                collection("want-to-read"),
            );
        expect(mangas).toHaveLength(250);
        // 100 + 100 + 50: the short page ends the loop, no extra request
        expect(sent).toHaveLength(3);
        expect(new Set(mangas.map((m) => m.mangaId)).size).toBe(250);
    });

    it("reads every page of a Kavita collection", async () => {
        total = 101;
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection(
                collection("collection-3"),
            );
        expect(mangas).toHaveLength(101);
        expect(sent).toHaveLength(2);
    });

    it("needs one more request when the last page is exactly full", async () => {
        total = 200;
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection(
                collection("want-to-read"),
            );
        expect(mangas).toHaveLength(200);
        // pages 1 and 2 are full, page 3 is empty and ends the loop
        expect(sent).toHaveLength(3);
    });

    it("handles an empty collection with a single request", async () => {
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection(
                collection("want-to-read"),
            );
        expect(mangas).toEqual([]);
        expect(sent).toHaveLength(1);
    });

    it("stops at 50 pages even if the server never ends", async () => {
        total = 1_000_000;
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection(
                collection("want-to-read"),
            );
        expect(sent).toHaveLength(50);
        expect(mangas).toHaveLength(5000);
    });
});

describe("discover paging", () => {
    const smartFilter = {
        id: "smartfilter-1",
        title: "x",
        type: "simpleCarousel",
    } as never;

    it("pages through a smart filter of more than one page", async () => {
        total = 90;
        const provider = new DiscoverProvider();
        // the fake server also answers the /Filter calls with a series list
        vi.stubGlobal("Application", {
            getState: (key: string) =>
                ({
                    kavita_url: "http://kavita",
                    kavita_apikey: "key",
                    kavita_page_size: "40",
                })[key],
            scheduleRequest: (request: SentRequest) => {
                sent.push(request);
                if (request.url.endsWith("/Filter")) {
                    return Promise.resolve([
                        { status: 200 },
                        JSON.stringify([
                            { id: 1, name: "x", filter: "enc", entityType: 0 },
                        ]),
                    ]);
                }
                if (request.url.endsWith("/Filter/decode")) {
                    return Promise.resolve([{ status: 200 }, "{}"]);
                }
                return Promise.resolve([
                    { status: 200 },
                    JSON.stringify(seriesPage(request.url)),
                ]);
            },
            arrayBufferToUTF8String: (buffer: string) => buffer,
        });

        let metadata: Kavita.Metadata | undefined;
        const ids: string[] = [];
        for (let i = 0; i < 5; i++) {
            const page = await provider.getDiscoverSectionItems(
                smartFilter,
                metadata,
            );
            ids.push(
                ...page.items.map(
                    (item) => (item as { mangaId: string }).mangaId,
                ),
            );
            // saved as JSON by Paperback: no undefined value allowed
            expect(
                JSON.parse(JSON.stringify(page.metadata ?? null)),
            ).toStrictEqual(page.metadata ?? null);
            if (!page.metadata) break;
            metadata = page.metadata;
        }
        // 40 + 40 + 10
        expect(ids).toHaveLength(90);
        expect(new Set(ids).size).toBe(90);
    });
});
