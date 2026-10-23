import type { SearchQuery } from "@paperback/types";
import { describe, expect, it } from "vitest";
import {
    buildFilterStatements,
    FILTER_COMBINATION,
    FILTER_COMPARISON,
    FILTER_FIELD,
} from "../utils/filters";

function query(filters: unknown[]): SearchQuery {
    return { title: "", filters } as unknown as SearchQuery;
}

describe("buildFilterStatements", () => {
    it("returns defaults without filters", () => {
        const result = buildFilterStatements({
            title: "",
        } as unknown as SearchQuery);
        expect(result.includeStatements).toEqual([]);
        expect(result.excludeStatements).toEqual([]);
        expect(result.includeCombination).toBe(FILTER_COMBINATION.And);
        expect(result.excludeCombination).toBe(FILTER_COMBINATION.Or);
    });

    it("splits included and excluded tags and resolves their titles", () => {
        const result = buildFilterStatements(
            query([
                {
                    id: "tags-genres",
                    options: [
                        { id: "1", value: "Action" },
                        { id: "2", value: "Romance" },
                    ],
                    value: { "1": "included", "2": "excluded" },
                },
            ]),
        );

        expect(result.includeStatements).toEqual([
            {
                comparison: FILTER_COMPARISON.Contains,
                field: FILTER_FIELD.genres,
                value: "Action",
            },
        ]);
        expect(result.excludeStatements).toEqual([
            {
                comparison: FILTER_COMPARISON.NotContains,
                field: FILTER_FIELD.genres,
                value: "Romance",
            },
        ]);
    });

    it("maps each tag section to its Kavita field", () => {
        const result = buildFilterStatements(
            query([
                {
                    id: "tags-people",
                    options: [{ id: "9", value: "Oda" }],
                    value: { "9": "included" },
                },
                {
                    id: "tags-tags",
                    options: [{ id: "3", value: "Pirates" }],
                    value: { "3": "included" },
                },
            ]),
        );
        expect(result.includeStatements.map((s) => s.field)).toEqual([
            FILTER_FIELD.writers,
            FILTER_FIELD.tags,
        ]);
    });

    it("reads the include and exclude operators", () => {
        const result = buildFilterStatements(
            query([
                { id: "includeOperator", value: "OR" },
                { id: "excludeOperator", value: "AND" },
            ]),
        );
        expect(result.includeCombination).toBe(FILTER_COMBINATION.Or);
        expect(result.excludeCombination).toBe(FILTER_COMBINATION.And);
    });

    it("falls back to the 'category:title' format of discover tags", () => {
        const result = buildFilterStatements(
            query([
                {
                    id: "tags-genres",
                    value: { "genres:Fantasy": "included" },
                },
            ]),
        );
        expect(result.includeStatements[0]?.value).toBe("Fantasy");
    });

    it("ignores unknown sections and unresolvable tags", () => {
        const result = buildFilterStatements(
            query([
                { id: "something-else", value: { "1": "included" } },
                { id: "tags-genres", value: { "99": "included" } },
            ]),
        );
        expect(result.includeStatements).toEqual([]);
    });
});
