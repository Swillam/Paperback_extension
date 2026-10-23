import type { ContentRating } from "@paperback/types";
import { describe, expect, it } from "vitest";
import {
    buildSynopsis,
    secondaryTitles,
    seriesInfoLines,
    seriesToSourceManga,
    toSeriesIds,
} from "../utils/manga";

describe("secondaryTitles", () => {
    it("drops titles identical to the primary one, whatever their case", () => {
        expect(
            secondaryTitles("Arrêtez-la", [
                "Arrêtez-la",
                " arrêtez-la ",
                "Arrêtez-la",
            ]),
        ).toEqual([]);
    });

    it("keeps distinct titles once, in order", () => {
        expect(
            secondaryTitles("Main", [
                "Other",
                "main",
                "Other",
                "Third",
                "",
                null,
                undefined,
            ]),
        ).toEqual(["Other", "Third"]);
    });
});

describe("seriesInfoLines", () => {
    it("skips empty or unknown values", () => {
        expect(
            seriesInfoLines({
                releaseYear: 0,
                language: "",
                publishers: [],
                translators: [],
                characters: [],
            }),
        ).toEqual([]);
    });

    it("lists what is available", () => {
        expect(
            seriesInfoLines({
                releaseYear: 2018,
                language: "fr-FR",
                publishers: [{ name: "Kana" }, { name: "Kana" }],
                characters: [{ name: "Aharen" }, { name: "Raido" }],
            }),
        ).toEqual([
            "Year: 2018",
            "Language: fr-FR",
            "Publisher: Kana",
            "Characters: Aharen, Raido",
        ]);
    });

    it("truncates long lists", () => {
        const characters = Array.from({ length: 13 }, (_, i) => ({
            name: `C${i}`,
        }));
        const [line] = seriesInfoLines({ characters });
        expect(line).toBe(
            "Characters: C0, C1, C2, C3, C4, C5, C6, C7, C8, C9 (+3)",
        );
    });
});

describe("buildSynopsis", () => {
    it("strips HTML and appends the info lines", () => {
        expect(buildSynopsis("<p>Hello <b>world</b></p>", ["Year: 2018"])).toBe(
            "Hello world\n\nYear: 2018",
        );
    });

    it("has no leading blank lines without a summary", () => {
        expect(buildSynopsis("", ["Year: 2018"])).toBe("Year: 2018");
        expect(buildSynopsis("Text", [])).toBe("Text");
        expect(buildSynopsis("", [])).toBe("");
    });
});

describe("seriesToSourceManga", () => {
    it("builds a minimal SourceManga from a series list item", () => {
        const manga = seriesToSourceManga(
            {
                id: 16,
                name: "Main",
                localizedName: "Main",
                originalName: "Original",
                sortName: "main",
                libraryId: 2,
            },
            "https://kavita/cover",
            "SAFE" as ContentRating,
        );
        expect(manga.mangaId).toBe("16");
        expect(manga.mangaInfo.primaryTitle).toBe("Main");
        expect(manga.mangaInfo.secondaryTitles).toEqual(["Original"]);
        expect(manga.mangaInfo.thumbnailUrl).toBe("https://kavita/cover");
        expect(manga.mangaInfo.additionalInfo).toEqual({ libraryId: "2" });
    });
});

describe("toSeriesIds", () => {
    it("converts manga ids and drops invalid ones", () => {
        expect(
            toSeriesIds([
                { mangaId: "16" },
                { mangaId: "abc" },
                { mangaId: "7" },
            ]),
        ).toEqual([16, 7]);
        expect(toSeriesIds([])).toEqual([]);
    });
});
