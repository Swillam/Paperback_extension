import { describe, expect, it } from "vitest";
import { TtlCache } from "../utils/TtlCache";

describe("TtlCache", () => {
    it("returns a value until it expires", () => {
        let now = 1000;
        const cache = new TtlCache<string>(500, () => now);

        cache.set("a", "value");
        expect(cache.get("a")).toBe("value");

        now = 1499;
        expect(cache.get("a")).toBe("value");

        now = 1500;
        expect(cache.get("a")).toBeUndefined();
    });

    it("returns undefined for unknown keys", () => {
        expect(new TtlCache<number>(100).get("nope")).toBeUndefined();
    });

    it("forgets deleted keys", () => {
        const cache = new TtlCache<number>(1000, () => 0);
        cache.set("a", 1);
        cache.delete("a");
        expect(cache.get("a")).toBeUndefined();
    });

    it("restarts the delay when a key is set again", () => {
        let now = 0;
        const cache = new TtlCache<number>(100, () => now);
        cache.set("a", 1);
        now = 90;
        cache.set("a", 2);
        now = 150;
        expect(cache.get("a")).toBe(2);
    });
});
