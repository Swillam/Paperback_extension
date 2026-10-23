import { describe, expect, it } from "vitest";
import {
    chapterDate,
    chapterName,
    isChapterRead,
    stripFileExtension,
} from "../utils/chapters";

describe("stripFileExtension", () => {
    it("removes known extensions, whatever their length", () => {
        expect(stripFileExtension("Special 1.cbz")).toBe("Special 1");
        expect(stripFileExtension("Book.epub")).toBe("Book");
        expect(stripFileExtension("Scan.CB7")).toBe("Scan");
        expect(stripFileExtension("Doc.pdf")).toBe("Doc");
    });

    it("leaves names without a known extension untouched", () => {
        expect(stripFileExtension("Vol. 1.5")).toBe("Vol. 1.5");
        expect(stripFileExtension("Omake")).toBe("Omake");
    });
});

describe("chapterName", () => {
    it("uses the title when the range is just the chapter number", () => {
        expect(
            chapterName({ number: "5", range: "5", titleName: "The Start" }),
        ).toBe("The Start");
        expect(chapterName({ number: "5", range: "5", titleName: null })).toBe(
            "",
        );
    });

    it("strips the leading number from a range and appends the title", () => {
        expect(
            chapterName({ number: "5", range: "5-Name", titleName: "Sub" }),
        ).toBe("Name - Sub");
        expect(
            chapterName({ number: "5", range: "5-Name", titleName: undefined }),
        ).toBe("Name");
    });
});

describe("chapterDate", () => {
    it("falls back to the creation date when there is no release date", () => {
        const date = chapterDate("0001-01-01T00:00:00", "2024-03-02T10:00:00");
        expect(date).toEqual(new Date("2024-03-02T10:00:00"));
    });

    it("prefers the release date", () => {
        const date = chapterDate("2020-01-01T00:00:00", "2024-03-02T10:00:00");
        expect(date).toEqual(new Date("2020-01-01T00:00:00"));
    });
});

describe("isChapterRead", () => {
    it("is read only when every page was read", () => {
        expect(isChapterRead(47, 47)).toBe(true);
        expect(isChapterRead(47, 46)).toBe(false);
        expect(isChapterRead(47, 1)).toBe(false);
        expect(isChapterRead(47, 0)).toBe(false);
    });

    it("never treats an empty chapter as read", () => {
        expect(isChapterRead(0, 0)).toBe(false);
    });
});
