import type { SearchQuery } from "@paperback/types";
import { describe, expect, it } from "vitest";
import {
    buildFilterPlan,
    extractTagId,
    FILTER_COMBINATION,
    FILTER_COMPARISON,
    FILTER_FIELD,
    parseConstraints,
    parseFilters,
} from "../utils/filters";

function query(filters: unknown[]): SearchQuery {
    return { title: "", filters } as unknown as SearchQuery;
}

function genres(
    values: Record<string, "included" | "excluded">,
    operators: { include?: "AND" | "OR"; exclude?: "AND" | "OR" } = {},
): SearchQuery {
    return query([
        { id: "includeOperator", value: operators.include ?? "AND" },
        { id: "excludeOperator", value: operators.exclude ?? "OR" },
        { id: "tags-genres", value: values },
    ]);
}

const stmt = (
    comparison: number,
    value: string,
    field = FILTER_FIELD.genres,
) => ({
    comparison,
    field,
    value,
});

describe("extractTagId", () => {
    it("reads the id of search filter tags and discover tags", () => {
        expect(extractTagId("genres-25:Comedy")).toBe("25");
        expect(extractTagId("people-7:Eiichiro_Oda")).toBe("7");
        expect(extractTagId("25:Comedy")).toBe("25");
        expect(extractTagId("12:Title: with colon")).toBe("12");
        // tags of the title view only carry the id
        expect(extractTagId("25")).toBe("25");
        expect(extractTagId("genres-25")).toBe("25");
    });

    it("returns undefined without a numeric id", () => {
        expect(extractTagId("Comedy")).toBeUndefined();
        expect(extractTagId("genres-Comedy")).toBeUndefined();
        expect(extractTagId("genres:Comedy")).toBeUndefined();
    });
});

describe("parseFilters", () => {
    it("returns defaults without filters", () => {
        const result = parseFilters({ title: "" } as unknown as SearchQuery);
        expect(result.include).toEqual([]);
        expect(result.exclude).toEqual([]);
        expect(result.includeCombination).toBe(FILTER_COMBINATION.And);
        expect(result.excludeCombination).toBe(FILTER_COMBINATION.Or);
    });

    it("sends ids, not titles, and keeps included and excluded apart", () => {
        const result = parseFilters(
            genres({
                "genres-1:Action": "included",
                "genres-2:Romance": "excluded",
            }),
        );
        expect(result.include).toEqual([stmt(FILTER_COMPARISON.Contains, "1")]);
        expect(result.exclude).toEqual([stmt(FILTER_COMPARISON.Contains, "2")]);
    });

    it("maps each tag section to its Kavita field", () => {
        const result = parseFilters(
            query([
                { id: "tags-people", value: { "people-9:Oda": "included" } },
                { id: "tags-tags", value: { "tags-3:Pirates": "included" } },
            ]),
        );
        expect(result.include.map((s) => s.field)).toEqual([
            FILTER_FIELD.writers,
            FILTER_FIELD.tags,
        ]);
    });

    it("reads the operators", () => {
        const result = parseFilters(
            genres({}, { include: "OR", exclude: "AND" }),
        );
        expect(result.includeCombination).toBe(FILTER_COMBINATION.Or);
        expect(result.excludeCombination).toBe(FILTER_COMBINATION.And);
    });

    it("accepts discover tags ('id:title') and ignores unusable ones", () => {
        const result = parseFilters(
            query([
                {
                    id: "tags-genres",
                    value: { "25:Fantasy": "included", Plain: "included" },
                },
                { id: "something-else", value: { "1:x": "included" } },
            ]),
        );
        expect(result.include).toEqual([
            stmt(FILTER_COMPARISON.Contains, "25"),
        ]);
    });
});

describe("buildFilterPlan", () => {
    const contains = FILTER_COMPARISON.Contains;
    const notContains = FILTER_COMPARISON.NotContains;

    it("has nothing to run without tags", () => {
        expect(buildFilterPlan(genres({}))).toEqual({
            main: undefined,
            excluded: undefined,
        });
    });

    it("only includes: one request with the include operator", () => {
        const plan = buildFilterPlan(
            genres(
                { "genres-1:A": "included", "genres-2:B": "included" },
                { include: "OR" },
            ),
        );
        expect(plan.excluded).toBeUndefined();
        expect(plan.main).toEqual({
            statements: [stmt(contains, "1"), stmt(contains, "2")],
            combination: FILTER_COMBINATION.Or,
        });
    });

    it("only excludes (any): NOT a AND NOT b", () => {
        const plan = buildFilterPlan(
            genres({ "genres-1:A": "excluded", "genres-2:B": "excluded" }),
        );
        expect(plan.excluded).toBeUndefined();
        expect(plan.main).toEqual({
            statements: [stmt(notContains, "1"), stmt(notContains, "2")],
            combination: FILTER_COMBINATION.And,
        });
    });

    it("only excludes (all): NOT a OR NOT b", () => {
        const plan = buildFilterPlan(
            genres(
                { "genres-1:A": "excluded", "genres-2:B": "excluded" },
                { exclude: "AND" },
            ),
        );
        expect(plan.main?.combination).toBe(FILTER_COMBINATION.Or);
        expect(plan.excluded).toBeUndefined();
    });

    it("includes ANDed with excludes (any): a single request", () => {
        const plan = buildFilterPlan(
            genres({
                "genres-1:A": "included",
                "genres-2:B": "included",
                "genres-3:C": "excluded",
            }),
        );
        expect(plan.excluded).toBeUndefined();
        expect(plan.main).toEqual({
            statements: [
                stmt(contains, "1"),
                stmt(contains, "2"),
                stmt(notContains, "3"),
            ],
            combination: FILTER_COMBINATION.And,
        });
    });

    it("a single include with excludes (any) is also a single request", () => {
        const plan = buildFilterPlan(
            genres(
                { "genres-1:A": "included", "genres-3:C": "excluded" },
                { include: "OR" },
            ),
        );
        expect(plan.excluded).toBeUndefined();
        expect(plan.main?.combination).toBe(FILTER_COMBINATION.And);
    });

    it("includes ORed with excludes needs a second request", () => {
        const plan = buildFilterPlan(
            genres(
                {
                    "genres-1:A": "included",
                    "genres-2:B": "included",
                    "genres-3:C": "excluded",
                },
                { include: "OR" },
            ),
        );
        expect(plan.main).toEqual({
            statements: [stmt(contains, "1"), stmt(contains, "2")],
            combination: FILTER_COMBINATION.Or,
        });
        expect(plan.excluded).toEqual({
            statements: [stmt(contains, "3")],
            combination: FILTER_COMBINATION.Or,
        });
    });

    it("excluding series that have ALL the tags needs a second request", () => {
        const plan = buildFilterPlan(
            genres(
                {
                    "genres-1:A": "included",
                    "genres-3:C": "excluded",
                    "genres-4:D": "excluded",
                },
                { exclude: "AND" },
            ),
        );
        expect(plan.excluded).toEqual({
            statements: [stmt(contains, "3"), stmt(contains, "4")],
            combination: FILTER_COMBINATION.And,
        });
    });
});

describe("parseConstraints", () => {
    const dropdowns = (values: Record<string, string>): SearchQuery =>
        query(Object.entries(values).map(([id, value]) => ({ id, value })));

    it("ignores 'any' and unknown values", () => {
        expect(
            parseConstraints(
                dropdowns({ library: "any", status: "any", readState: "any" }),
            ),
        ).toEqual([]);
        expect(
            parseConstraints(dropdowns({ library: "abc", readState: "x" })),
        ).toEqual([]);
    });

    it("builds library and status statements", () => {
        expect(
            parseConstraints(dropdowns({ library: "2", status: "2" })),
        ).toEqual([
            {
                comparison: FILTER_COMPARISON.Equal,
                field: FILTER_FIELD.libraries,
                value: "2",
            },
            {
                comparison: FILTER_COMPARISON.Equal,
                field: FILTER_FIELD.publicationStatus,
                value: "2",
            },
        ]);
    });

    it("maps the read states to read progress percentages", () => {
        const progress = (comparison: number, value: string) => ({
            comparison,
            field: FILTER_FIELD.readProgress,
            value,
        });
        expect(parseConstraints(dropdowns({ readState: "unread" }))).toEqual([
            progress(FILTER_COMPARISON.Equal, "0"),
        ]);
        expect(parseConstraints(dropdowns({ readState: "reading" }))).toEqual([
            progress(FILTER_COMPARISON.GreaterThan, "0"),
            progress(FILTER_COMPARISON.LessThan, "100"),
        ]);
        expect(parseConstraints(dropdowns({ readState: "read" }))).toEqual([
            progress(FILTER_COMPARISON.Equal, "100"),
        ]);
    });
});

describe("buildFilterPlan with dropdown constraints", () => {
    const library = { id: "library", value: "2" };
    const libraryStatement = {
        comparison: FILTER_COMPARISON.Equal,
        field: FILTER_FIELD.libraries,
        value: "2",
    };

    it("runs the constraints alone when no tag is selected", () => {
        const plan = buildFilterPlan(query([library]));
        expect(plan.main).toEqual({
            statements: [libraryStatement],
            combination: FILTER_COMBINATION.And,
        });
        expect(plan.required).toBeUndefined();
    });

    it("merges them in an ANDed request", () => {
        const plan = buildFilterPlan(
            query([
                library,
                { id: "tags-genres", value: { "genres-1:A": "included" } },
            ]),
        );
        expect(plan.main?.combination).toBe(FILTER_COMBINATION.And);
        expect(plan.main?.statements).toContainEqual(libraryStatement);
        expect(plan.main?.statements).toHaveLength(2);
        expect(plan.required).toBeUndefined();
    });

    it("keeps them apart when the includes are ORed", () => {
        const plan = buildFilterPlan(
            query([
                library,
                { id: "includeOperator", value: "OR" },
                {
                    id: "tags-genres",
                    value: {
                        "genres-1:A": "included",
                        "genres-2:B": "included",
                    },
                },
            ]),
        );
        expect(plan.main?.combination).toBe(FILTER_COMBINATION.Or);
        expect(plan.main?.statements).toHaveLength(2);
        expect(plan.required).toEqual({
            statements: [libraryStatement],
            combination: FILTER_COMBINATION.And,
        });
    });
});
