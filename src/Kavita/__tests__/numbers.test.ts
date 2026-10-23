import { describe, expect, it } from "vitest";
import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    parsePageSize,
    toInt,
} from "../utils/numbers";

describe("parsePageSize", () => {
    it("parses valid values", () => {
        expect(parsePageSize("40")).toBe(40);
        expect(parsePageSize(40)).toBe(40);
        expect(parsePageSize(" 15 ")).toBe(15);
    });

    it("falls back to the default for empty or invalid values", () => {
        for (const raw of [undefined, null, "", "abc", "0", "-5", NaN, {}]) {
            expect(parsePageSize(raw)).toBe(DEFAULT_PAGE_SIZE);
        }
    });

    it("caps huge values", () => {
        expect(parsePageSize("100000")).toBe(MAX_PAGE_SIZE);
    });

    it("drops decimals", () => {
        expect(parsePageSize("12.9")).toBe(12);
    });
});

describe("toInt", () => {
    it("parses numeric strings and numbers", () => {
        expect(toInt("42")).toBe(42);
        expect(toInt(7)).toBe(7);
    });

    it("uses the fallback when missing or invalid", () => {
        expect(toInt(undefined)).toBe(0);
        expect(toInt("x", 5)).toBe(5);
        expect(toInt(null, -1)).toBe(-1);
    });
});
