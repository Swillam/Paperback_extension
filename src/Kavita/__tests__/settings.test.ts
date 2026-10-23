import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterProvider } from "../providers/ChapterProvider";
import { DiscoverProvider } from "../providers/DiscoverProvider";
import {
    getDiscoverOrder,
    getOptimizeUpdates,
    getSkipNewThreshold,
    getSkipStatuses,
    getSkipUnreadThreshold,
    resetSettings,
} from "../settings";
import {
    DISCOVER_GROUPS,
    normalizeOrder,
    swapItems,
} from "../utils/discoverOrder";
import {
    describeSkip,
    shouldRefreshChapters,
    shouldSkipByCount,
    skipThresholdOptions,
} from "../utils/updates";

let state: Record<string, unknown>;
let sent: { url: string; body?: string }[];

beforeEach(() => {
    state = { kavita_url: "http://kavita", kavita_apikey: "key" };
    sent = [];
    vi.stubGlobal("Application", {
        getState: (key: string) => state[key],
        setState: (value: unknown, key: string) => {
            if (value === undefined) delete state[key];
            else state[key] = value;
        },
        invalidateDiscoverSections: () => undefined,
        scheduleRequest: (request: { url: string; body?: string }) => {
            sent.push(request);
            if (request.url.includes("/Library/libraries")) {
                return Promise.resolve([
                    { status: 200 },
                    JSON.stringify([{ id: 1, name: "Manga", type: 0 }]),
                ]);
            }
            if (request.url.includes("series-by-ids")) {
                return Promise.resolve([
                    { status: 200 },
                    JSON.stringify([{ id: 1, lastChapterAddedUtc: "B" }]),
                ]);
            }
            return Promise.resolve([{ status: 200 }, "[]"]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("shouldSkipByCount", () => {
    it("never skips when off or without counts", () => {
        expect(shouldSkipByCount(0, 5, 10)).toBe(false);
        expect(shouldSkipByCount(1, undefined, 10)).toBe(false);
        expect(shouldSkipByCount(1, 5, undefined)).toBe(false);
        expect(shouldSkipByCount(1, 5, 0)).toBe(false);
    });

    it("1 means at least one", () => {
        expect(shouldSkipByCount(1, 1, 10)).toBe(true);
        expect(shouldSkipByCount(1, 0, 10)).toBe(false);
    });

    it("other values are a percentage of the chapters", () => {
        expect(shouldSkipByCount(50, 5, 10)).toBe(true);
        expect(shouldSkipByCount(50, 4, 10)).toBe(false);
        expect(shouldSkipByCount(100, 10, 10)).toBe(true);
        expect(shouldSkipByCount(100, 9, 10)).toBe(false);
    });
});

describe("shouldRefreshChapters with the update settings", () => {
    const changed = {
        storedMarker: "A",
        apiMarker: "B",
        unreadChapterCount: 0,
        newChapterCount: 0,
        chapterCount: 10,
        status: "Ongoing",
    };

    it("refreshes a changed series by default", () => {
        expect(shouldRefreshChapters(changed)).toBe(true);
    });

    it("skips by unread chapters, as before the setting existed", () => {
        expect(
            shouldRefreshChapters({ ...changed, unreadChapterCount: 2 }),
        ).toBe(false);
        expect(
            shouldRefreshChapters({
                ...changed,
                unreadChapterCount: 2,
                skipUnread: 0,
            }),
        ).toBe(true);
        expect(
            shouldRefreshChapters({
                ...changed,
                unreadChapterCount: 2,
                skipUnread: 50,
            }),
        ).toBe(true);
        expect(
            shouldRefreshChapters({
                ...changed,
                unreadChapterCount: 6,
                skipUnread: 50,
            }),
        ).toBe(false);
    });

    it("skips by new chapters when asked", () => {
        expect(shouldRefreshChapters({ ...changed, newChapterCount: 3 })).toBe(
            true,
        );
        expect(
            shouldRefreshChapters({
                ...changed,
                newChapterCount: 3,
                skipNew: 1,
            }),
        ).toBe(false);
    });

    it("skips by publication status when asked", () => {
        expect(
            shouldRefreshChapters({
                ...changed,
                status: "Completed",
                skipStatuses: ["Completed"],
            }),
        ).toBe(false);
        expect(
            shouldRefreshChapters({
                ...changed,
                status: "Ongoing",
                skipStatuses: ["Completed"],
            }),
        ).toBe(true);
        expect(
            shouldRefreshChapters({
                ...changed,
                status: undefined,
                skipStatuses: ["Completed"],
            }),
        ).toBe(true);
    });
});

describe("skip descriptions", () => {
    it("describes each threshold", () => {
        expect(describeSkip(0, "unread")).toBe("Off");
        expect(describeSkip(1, "unread")).toContain("1+ unread");
        expect(describeSkip(50, "new")).toContain("50%+ new");
    });

    it("offers the same thresholds the settings understand", () => {
        expect(skipThresholdOptions("unread").map((o) => o.id)).toEqual([
            "0",
            "1",
            "25",
            "50",
            "75",
            "100",
        ]);
    });
});

describe("discover order", () => {
    it("falls back to the default order", () => {
        expect(normalizeOrder(undefined)).toEqual([...DISCOVER_GROUPS]);
        expect(normalizeOrder("nope")).toEqual([...DISCOVER_GROUPS]);
    });

    it("keeps a saved order, drops unknown and repeated ids and appends the missing groups", () => {
        const order = normalizeOrder([
            "smart_filters",
            "x",
            "ondeck",
            "ondeck",
            3,
        ]);
        expect(order.slice(0, 2)).toEqual(["smart_filters", "ondeck"]);
        expect(order).toHaveLength(DISCOVER_GROUPS.length);
        expect(new Set(order).size).toBe(DISCOVER_GROUPS.length);
    });

    it("swaps two items and refuses out of range moves", () => {
        expect(swapItems([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
        expect(swapItems([1, 2, 3], 2, 3)).toBeNull();
        expect(swapItems([1, 2, 3], 0, -1)).toBeNull();
    });
});

describe("settings getters", () => {
    it("have defaults that keep the previous behaviour", () => {
        expect(getOptimizeUpdates()).toBe(true);
        expect(getSkipUnreadThreshold()).toBe(1);
        expect(getSkipNewThreshold()).toBe(0);
        expect(getSkipStatuses()).toEqual([]);
        expect(getDiscoverOrder()).toEqual([...DISCOVER_GROUPS]);
    });

    it("read the stored values, also the select row arrays", () => {
        state["kavita_skip_unread"] = ["50"];
        state["kavita_skip_new"] = "25";
        state["kavita_skip_status"] = ["Completed", 3];
        state["kavita_optimize_updates"] = false;
        expect(getSkipUnreadThreshold()).toBe(50);
        expect(getSkipNewThreshold()).toBe(25);
        expect(getSkipStatuses()).toEqual(["Completed"]);
        expect(getOptimizeUpdates()).toBe(false);
    });

    it("ignore invalid thresholds", () => {
        state["kavita_skip_unread"] = ["abc"];
        state["kavita_skip_new"] = ["500"];
        expect(getSkipUnreadThreshold()).toBe(1);
        expect(getSkipNewThreshold()).toBe(0);
    });

    it("resetSettings keeps the server URL and API key", () => {
        state["kavita_page_size"] = 50;
        state["kavita_show_ondeck"] = false;
        state["kavita_discover_order"] = ["libraries"];
        state["kavita_skip_unread"] = ["50"];
        resetSettings();
        expect(state).toEqual({
            kavita_url: "http://kavita",
            kavita_apikey: "key",
        });
    });
});

describe("providers follow the settings", () => {
    it("lists the discover groups in the saved order", async () => {
        state["kavita_discover_order"] = ["libraries", "recently_added"];
        const sections = await new DiscoverProvider().getDiscoverSections();
        expect(sections.map((s) => s.id).slice(0, 2)).toEqual([
            "1",
            "recently_added",
        ]);
        expect(sections.map((s) => s.id)).toContain("ondeck");
    });

    it("does not check updates when optimized updates are off", async () => {
        state["kavita_optimize_updates"] = false;
        const skipped: string[] = [];
        await new ChapterProvider().processTitlesForUpdates({
            getQueuedItems: () => [{ mangaId: "1", mangaInfo: {} }],
            setNewChapters: (id: string) => {
                skipped.push(id);
                return Promise.resolve();
            },
        } as never);
        expect(sent).toEqual([]);
        expect(skipped).toEqual([]);
    });

    it("skips the statuses chosen in the settings", async () => {
        state["kavita_skip_status"] = ["Completed"];
        const skipped: string[] = [];
        await new ChapterProvider().processTitlesForUpdates({
            getQueuedItems: () => [
                {
                    mangaId: "1",
                    mangaInfo: {
                        status: "Completed",
                        additionalInfo: { latestUploadedChapter: "A" },
                    },
                },
            ],
            setNewChapters: (id: string) => {
                skipped.push(id);
                return Promise.resolve();
            },
        } as never);
        // the marker changed (A -> B), but the series is completed
        expect(skipped).toEqual(["1"]);
    });
});
