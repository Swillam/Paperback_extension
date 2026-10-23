import { describe, expect, it } from "vitest";
import { getSortingOptionList, kavitaSortFor } from "../utils/sorting";

describe("sorting options", () => {
    it("offers unique ids with labels", () => {
        const options = getSortingOptionList();
        expect(options.length).toBeGreaterThan(1);
        expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
        for (const option of options) expect(option.label).not.toBe("");
    });

    it("maps every offered option to a Kavita sort", () => {
        for (const option of getSortingOptionList()) {
            const sort = kavitaSortFor(option.id);
            expect(sort.sortField).toBeGreaterThan(0);
        }
    });

    it("maps known options to the right Kavita fields and directions", () => {
        expect(kavitaSortFor("name-desc")).toEqual({
            sortField: 1,
            isAscending: false,
        });
        expect(kavitaSortFor("updated")).toEqual({
            sortField: 4,
            isAscending: false,
        });
        expect(kavitaSortFor("year-asc")).toEqual({
            sortField: 6,
            isAscending: true,
        });
    });

    it("falls back to name A-Z", () => {
        const fallback = { sortField: 1, isAscending: true };
        expect(kavitaSortFor(undefined)).toEqual(fallback);
        expect(kavitaSortFor("nope")).toEqual(fallback);
    });
});
