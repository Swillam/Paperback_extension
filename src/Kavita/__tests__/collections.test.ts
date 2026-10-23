import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionProvider } from "../providers/CollectionProvider";
import {
    collectionManagedId,
    parseCollectionRef,
    WANT_TO_READ_ID,
} from "../utils/collections";

describe("collection ids", () => {
    it("round-trips Kavita collection ids", () => {
        expect(parseCollectionRef(collectionManagedId(5))).toEqual({
            kind: "collection",
            id: 5,
        });
    });

    it("recognises Want to Read", () => {
        expect(parseCollectionRef(WANT_TO_READ_ID)).toEqual({
            kind: "want-to-read",
        });
    });

    it("rejects unknown ids", () => {
        for (const id of ["", "collection-", "collection-x", "reading", "5"]) {
            expect(parseCollectionRef(id)).toBeUndefined();
        }
    });
});

interface SentRequest {
    url: string;
    method?: string;
    body?: string;
}

let sent: SentRequest[];
let answers: Record<string, unknown>;

beforeEach(() => {
    sent = [];
    answers = {};
    vi.stubGlobal("Application", {
        getState: (key: string) =>
            ({ kavita_url: "http://kavita", kavita_apikey: "key" })[key],
        scheduleRequest: (request: SentRequest) => {
            sent.push(request);
            const key = Object.keys(answers).find((k) =>
                request.url.includes(k),
            );
            const payload = JSON.stringify(key ? answers[key] : []);
            return Promise.resolve([{ status: 200 }, payload]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const manga = (id: number) => ({ mangaId: `${id}` }) as never;

describe("CollectionProvider", () => {
    it("lists Want to Read first, then the user's collections", async () => {
        answers["/Collection?"] = [
            { id: 3, title: "Favourites" },
            { id: 9, title: "To buy" },
        ];
        const collections =
            await new CollectionProvider().getManagedLibraryCollections();
        expect(collections).toEqual([
            { id: "want-to-read", title: "Want to Read" },
            { id: "collection-3", title: "Favourites" },
            { id: "collection-9", title: "To buy" },
        ]);
    });

    it("reads the series of a collection", async () => {
        answers["series-by-collection"] = [
            { id: 16, name: "A", libraryId: 2 },
            { id: 20, name: "B", libraryId: 2 },
        ];
        const mangas =
            await new CollectionProvider().getSourceMangaInManagedCollection({
                id: "collection-1",
                title: "Test",
            });
        expect(mangas.map((m) => m.mangaId)).toEqual(["16", "20"]);
        expect(sent[0]?.url).toContain("collectionId=1");
        expect(sent[0]?.method).toBe("GET");
    });

    it("adds series to a collection with its id and title", async () => {
        await new CollectionProvider().commitManagedCollectionChanges({
            collection: { id: "collection-4", title: "Favourites" },
            additions: [manga(16), manga(47)],
            deletions: [],
        });
        expect(sent).toHaveLength(1);
        expect(sent[0]?.url).toContain("/Collection/update-for-series");
        expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({
            collectionTagId: 4,
            collectionTagTitle: "Favourites",
            seriesIds: [16, 47],
        });
    });

    it("removes series by sending back the whole collection", async () => {
        answers["/Collection/single"] = {
            id: 4,
            title: "Favourites",
            itemCount: 3,
        };
        await new CollectionProvider().commitManagedCollectionChanges({
            collection: { id: "collection-4", title: "Favourites" },
            additions: [],
            deletions: [manga(20)],
        });
        expect(sent[0]?.url).toContain("/Collection/single?collectionId=4");
        expect(sent[1]?.url).toContain("/Collection/update-series");
        expect(JSON.parse(sent[1]?.body ?? "{}")).toEqual({
            tag: { id: 4, title: "Favourites", itemCount: 3 },
            seriesIdsToRemove: [20],
        });
    });

    it("sends nothing when there is nothing to change", async () => {
        await new CollectionProvider().commitManagedCollectionChanges({
            collection: { id: "want-to-read", title: "Want to Read" },
            additions: [],
            deletions: [],
        });
        expect(sent).toEqual([]);
    });

    it("rejects an unknown collection", async () => {
        await expect(
            new CollectionProvider().getSourceMangaInManagedCollection({
                id: "nope",
                title: "?",
            }),
        ).rejects.toThrow("Unknown Kavita collection");
    });
});
