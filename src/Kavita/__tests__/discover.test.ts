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
        ]);
    });

    it("does not even ask for the libraries when they are hidden", async () => {
        state["kavita_show_libraries"] = false;
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
