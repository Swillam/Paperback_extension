import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverProvider } from "../providers/DiscoverProvider";
import { isDiscoverSectionEnabled } from "../settings";

interface SentRequest {
    url: string;
    body?: string;
}

let state: Record<string, unknown>;
let sent: SentRequest[];

function respond(url: string): unknown {
    if (url.includes("/Filter/decode")) {
        return { id: 0, name: "Completed", statements: [], combination: 1 };
    }
    if (url.includes("/Filter")) {
        return [
            { id: 4, name: "Completed", filter: "enc", entityType: 0 },
            { id: 5, name: "Authors", filter: "enc2", entityType: 1 },
        ];
    }
    if (url.includes("/Library/libraries")) {
        return [
            { id: 1, name: "Manga", type: 0 },
            { id: 3, name: "Books", type: 2 },
        ];
    }
    return [
        { id: 7, name: "Series A", libraryId: 1 },
        { id: 8, name: "Series B", libraryId: 1 },
    ];
}

beforeEach(() => {
    state = { kavita_url: "http://kavita", kavita_apikey: "key" };
    sent = [];
    vi.stubGlobal("Application", {
        getState: (key: string) => state[key],
        scheduleRequest: (request: SentRequest) => {
            sent.push(request);
            const payload = JSON.stringify(respond(request.url));
            return Promise.resolve([{ status: 200 }, payload]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("isDiscoverSectionEnabled", () => {
    it("shows every section by default", () => {
        expect(isDiscoverSectionEnabled("ondeck")).toBe(true);
    });

    it("follows the stored setting", () => {
        state["kavita_show_ondeck"] = false;
        expect(isDiscoverSectionEnabled("ondeck")).toBe(false);
        state["kavita_show_ondeck"] = true;
        expect(isDiscoverSectionEnabled("ondeck")).toBe(true);
    });

    it("ignores values that are not booleans", () => {
        state["kavita_show_ondeck"] = "false";
        expect(isDiscoverSectionEnabled("ondeck")).toBe(true);
    });
});

describe("DiscoverProvider.getDiscoverSections", () => {
    it("lists the built-in sections and the libraries, skipping book libraries", async () => {
        const sections = await new DiscoverProvider().getDiscoverSections();
        expect(sections.map((s) => s.id)).toEqual([
            "ondeck",
            "latest_updates",
            "recently_added",
            "tag_sections",
            "1",
            "smartfilter-4",
        ]);
    });

    it("hides the disabled sections", async () => {
        state["kavita_show_ondeck"] = false;
        state["kavita_show_tag_sections"] = false;
        const sections = await new DiscoverProvider().getDiscoverSections();
        expect(sections.map((s) => s.id)).toEqual([
            "latest_updates",
            "recently_added",
            "1",
            "smartfilter-4",
        ]);
    });

    it("does not even ask for the libraries and smart filters when they are hidden", async () => {
        state["kavita_show_libraries"] = false;
        state["kavita_show_smart_filters"] = false;
        const sections = await new DiscoverProvider().getDiscoverSections();
        expect(sections.map((s) => s.id)).not.toContain("1");
        expect(sent).toEqual([]);
    });
});

describe("DiscoverProvider.getLibrarySection", () => {
    it("filters the library on the server with a statement", async () => {
        const result = await new DiscoverProvider().getLibrarySection({
            id: "1",
            title: "Manga",
            type: "prominentCarousel",
        } as never);

        expect(result.items).toHaveLength(2);
        const body = JSON.parse(sent[0]?.body ?? "{}") as {
            statements: { field: number; comparison: number; value: string }[];
        };
        expect(body.statements).toEqual([
            { comparison: 0, field: 19, value: "1" },
        ]);
        // the ignored libraryId query parameter is gone
        expect(sent[0]?.url).not.toContain("libraryId=");
    });
});

describe("smart filters", () => {
    it("lists the series smart filters only", async () => {
        const sections = await new DiscoverProvider().getDiscoverSections();
        const smart = sections.filter((s) => s.id.startsWith("smartfilter-"));
        expect(smart.map((s) => [s.id, s.title])).toEqual([
            ["smartfilter-4", "Completed"],
        ]);
    });

    it("keeps the other sections when the server has no smart filters", async () => {
        vi.stubGlobal("Application", {
            getState: (key: string) => state[key],
            scheduleRequest: (request: SentRequest) => {
                if (request.url.includes("/Filter")) {
                    return Promise.resolve([{ status: 404 }, ""]);
                }
                const payload = JSON.stringify(respond(request.url));
                return Promise.resolve([{ status: 200 }, payload]);
            },
            arrayBufferToUTF8String: (buffer: string) => buffer,
        });
        const sections = await new DiscoverProvider().getDiscoverSections();
        expect(sections.map((s) => s.id)).toEqual([
            "ondeck",
            "latest_updates",
            "recently_added",
            "tag_sections",
            "1",
        ]);
    });

    it("decodes the filter, then runs it with the page size", async () => {
        state["kavita_page_size"] = "2";
        const result = await new DiscoverProvider().getDiscoverSectionItems(
            {
                id: "smartfilter-4",
                title: "Completed",
                type: "simpleCarousel",
            } as never,
            undefined,
        );

        expect(sent.map((r) => r.url)).toEqual([
            "http://kavita/api/Filter",
            "http://kavita/api/Filter/decode",
            "http://kavita/api/Series/all-v2?PageNumber=1&PageSize=2",
        ]);
        expect(JSON.parse(sent[1]?.body ?? "{}")).toEqual({
            encodedFilter: "enc",
        });
        expect(
            result.items.map((i) => (i as { mangaId: string }).mangaId),
        ).toEqual(["7", "8"]);
        // a full page means there may be more
        expect(result.metadata).toStrictEqual({ offset: 1 });
    });

    it("stops paging on a short page", async () => {
        state["kavita_page_size"] = "10";
        const result = await new DiscoverProvider().getDiscoverSectionItems(
            {
                id: "smartfilter-4",
                title: "Completed",
                type: "simpleCarousel",
            } as never,
            { offset: 1 },
        );
        expect(sent[2]?.url).toContain("PageNumber=2");
        expect(result.metadata).toBeUndefined();
    });

    it("explains when the filter was deleted in Kavita", async () => {
        await expect(
            new DiscoverProvider().getDiscoverSectionItems(
                {
                    id: "smartfilter-99",
                    title: "Gone",
                    type: "simpleCarousel",
                } as never,
                undefined,
            ),
        ).rejects.toThrow("no longer exists");
    });
});
