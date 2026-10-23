import { describe, expect, it } from "vitest";
import {
    parseSmartFilterSectionId,
    smartFilterSectionId,
} from "../utils/smartFilters";

describe("smart filter section ids", () => {
    it("round-trips", () => {
        expect(parseSmartFilterSectionId(smartFilterSectionId(12))).toBe(12);
    });

    it("ignores other section ids", () => {
        for (const id of [
            "ondeck",
            "1",
            "smartfilter-",
            "smartfilter-x",
            "tag_sections",
        ]) {
            expect(parseSmartFilterSectionId(id)).toBeUndefined();
        }
    });
});
