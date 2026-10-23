import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkConnection } from "../utils/connection";
import { isOlderThan, parseVersion } from "../utils/version";

describe("parseVersion", () => {
    it("parses dotted versions", () => {
        expect(parseVersion("0.9.1.4")).toEqual([0, 9, 1, 4]);
        expect(parseVersion(" 0.8 ")).toEqual([0, 8]);
    });

    it("returns nothing for text that is not a version", () => {
        expect(parseVersion("")).toEqual([]);
        expect(parseVersion("dev")).toEqual([]);
        expect(parseVersion("0.x")).toEqual([]);
    });
});

describe("isOlderThan", () => {
    it("compares number by number", () => {
        expect(isOlderThan("0.7.14.10", [0, 8])).toBe(true);
        expect(isOlderThan("0.8.0.0", [0, 8])).toBe(false);
        expect(isOlderThan("0.9.1.4", [0, 8])).toBe(false);
        expect(isOlderThan("1.0", [0, 8])).toBe(false);
    });

    it("does not report unknown versions", () => {
        expect(isOlderThan("dev", [0, 8])).toBe(false);
    });
});

describe("checkConnection", () => {
    let answer: { status: number; body: string };

    beforeEach(() => {
        answer = { status: 200, body: "" };
        vi.stubGlobal("Application", {
            scheduleRequest: () =>
                Promise.resolve([{ status: answer.status }, answer.body]),
            arrayBufferToUTF8String: (buffer: string) => buffer,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const ok = (version: string) =>
        JSON.stringify({ token: "t", username: "me", kavitaVersion: version });

    it("explains an empty URL or key", async () => {
        expect(await checkConnection("", "key")).toBe("Server URL is empty.");
        expect(await checkConnection("http://k/api", " ")).toBe(
            "API key is empty.",
        );
    });

    it("reports a rejected key", async () => {
        answer = { status: 401, body: "" };
        expect(await checkConnection("http://k/api", "bad")).toContain(
            "rejected",
        );
    });

    it("reports a URL that is not Kavita", async () => {
        answer = { status: 200, body: "<html></html>" };
        expect(await checkConnection("http://k/api", "key")).toContain(
            "Check the URL",
        );
    });

    it("reports the user and version on success", async () => {
        answer = { status: 200, body: ok("0.9.1.4") };
        expect(await checkConnection("http://k/api", "key")).toBe(
            "Connected as me (Kavita 0.9.1.4).",
        );
    });

    it("recommends updating an old Kavita", async () => {
        answer = { status: 200, body: ok("0.7.14.10") };
        const message = await checkConnection("http://k/api", "key");
        expect(message).toContain("Connected as me (Kavita 0.7.14.10).");
        expect(message).toContain("0.8 or newer is recommended");
    });
});
