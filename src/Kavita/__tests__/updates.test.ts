import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterProvider } from "../providers/ChapterProvider";
import { chunk, shouldRefreshChapters } from "../utils/updates";

describe("shouldRefreshChapters", () => {
    const base = {
        storedMarker: "2024-01-01T00:00:00",
        apiMarker: "2024-01-01T00:00:00",
        unreadChapterCount: 0,
        chapterCount: 10,
    };

    it("skips a series whose marker did not change", () => {
        expect(shouldRefreshChapters(base)).toBe(false);
    });

    it("refreshes when a chapter was added", () => {
        expect(
            shouldRefreshChapters({
                ...base,
                apiMarker: "2024-02-01T00:00:00",
            }),
        ).toBe(true);
    });

    it("refreshes a series that never stored a marker", () => {
        expect(
            shouldRefreshChapters({ ...base, storedMarker: undefined }),
        ).toBe(true);
    });

    it("skips a series Kavita no longer reports", () => {
        expect(shouldRefreshChapters({ ...base, apiMarker: undefined })).toBe(
            false,
        );
    });

    it("skips a series that still has unread chapters", () => {
        expect(
            shouldRefreshChapters({
                ...base,
                apiMarker: "2024-02-01T00:00:00",
                unreadChapterCount: 3,
            }),
        ).toBe(false);
    });

    it("does not rely on counts that are not known yet", () => {
        expect(
            shouldRefreshChapters({
                ...base,
                apiMarker: "2024-02-01T00:00:00",
                unreadChapterCount: undefined,
                chapterCount: undefined,
            }),
        ).toBe(true);
    });
});

describe("chunk", () => {
    it("splits in groups of at most the given size", () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([], 3)).toEqual([]);
    });
});

interface SentRequest {
    url: string;
    body?: string;
}

let sent: SentRequest[];
let apiSeries: { id: number; lastChapterAddedUtc: string }[];
let failRequests: boolean;

beforeEach(() => {
    sent = [];
    failRequests = false;
    apiSeries = [];
    vi.stubGlobal("Application", {
        getState: (key: string) => ({ kavita_url: "http://kavita" })[key],
        scheduleRequest: (request: SentRequest) => {
            sent.push(request);
            if (failRequests) return Promise.resolve([{ status: 500 }, ""]);
            return Promise.resolve([
                { status: 200 },
                JSON.stringify(apiSeries),
            ]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function queued(
    id: number,
    marker: string | undefined,
    extra: Record<string, unknown> = {},
) {
    return {
        mangaId: `${id}`,
        mangaInfo: {
            additionalInfo: marker ? { latestUploadedChapter: marker } : {},
        },
        ...extra,
    };
}

function updateManager(items: unknown[]) {
    const skipped: string[] = [];
    return {
        skipped,
        manager: {
            getQueuedItems: () => items,
            setNewChapters: (mangaId: string, chapters: unknown[]) => {
                expect(chapters).toEqual([]);
                skipped.push(mangaId);
                return Promise.resolve();
            },
        } as never,
    };
}

describe("ChapterProvider.processTitlesForUpdates", () => {
    it("checks all the series with a single request", async () => {
        apiSeries = [
            { id: 1, lastChapterAddedUtc: "A" },
            { id: 2, lastChapterAddedUtc: "B2" },
        ];
        const { skipped, manager } = updateManager([
            queued(1, "A"),
            queued(2, "B"),
        ]);

        await new ChapterProvider().processTitlesForUpdates(manager);

        expect(sent).toHaveLength(1);
        expect(sent[0]?.url).toBe("http://kavita/api/Series/series-by-ids");
        expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({
            seriesIds: [1, 2],
        });
        // 1 is unchanged: skipped. 2 got a new chapter: left to Paperback's default flow
        expect(skipped).toEqual(["1"]);
    });

    it("skips the series Kavita does not return", async () => {
        apiSeries = [{ id: 1, lastChapterAddedUtc: "A" }];
        const { skipped, manager } = updateManager([
            queued(1, "OLD"),
            queued(7, "X"),
        ]);

        await new ChapterProvider().processTitlesForUpdates(manager);

        expect(skipped).toEqual(["7"]);
    });

    it("leaves everything to the default flow when the request fails", async () => {
        failRequests = true;
        const { skipped, manager } = updateManager([queued(1, "A")]);

        await new ChapterProvider().processTitlesForUpdates(manager);

        expect(skipped).toEqual([]);
    });

    it("sends the series in batches of 100", async () => {
        const items = Array.from({ length: 250 }, (_, i) => queued(i + 1, "A"));
        const { manager } = updateManager(items);

        await new ChapterProvider().processTitlesForUpdates(manager);

        expect(sent).toHaveLength(3);
        const sizes = sent.map(
            (r) =>
                (JSON.parse(r.body ?? "{}") as { seriesIds: number[] })
                    .seriesIds.length,
        );
        expect(sizes).toEqual([100, 100, 50]);
    });
});
