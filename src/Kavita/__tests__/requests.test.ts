import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJSON, sendChecked, sendRequest } from "../utils/CommonUtils";

let statuses: number[];
let sent: string[];

beforeEach(() => {
    sent = [];
    statuses = [];
    vi.stubGlobal("Application", {
        scheduleRequest: (request: { url: string }) => {
            sent.push(request.url);
            const status = statuses.shift() ?? 200;
            return Promise.resolve([{ status }, JSON.stringify({ ok: true })]);
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const request = (url = "http://kavita/api/Series/1") => ({
    url,
    method: "GET",
});

describe("sendRequest", () => {
    it("sends once when everything is fine", async () => {
        await sendRequest(request());
        expect(sent).toHaveLength(1);
    });

    it("sends the request once more after a 401 (expired token)", async () => {
        statuses = [401, 200];
        const [response] = await sendRequest(request());
        expect(sent).toHaveLength(2);
        expect(response.status).toBe(200);
    });

    it("gives up after a second 401", async () => {
        statuses = [401, 401, 200];
        const [response] = await sendRequest(request());
        expect(sent).toHaveLength(2);
        expect(response.status).toBe(401);
    });

    it("does not retry other errors", async () => {
        statuses = [500, 200];
        const [response] = await sendRequest(request());
        expect(sent).toHaveLength(1);
        expect(response.status).toBe(500);
    });

    it("does not retry a wrong API key at sign-in", async () => {
        statuses = [401, 200];
        await sendRequest(
            request("http://kavita/api/Plugin/authenticate?apiKey=x"),
        );
        expect(sent).toHaveLength(1);
    });
});

describe("sendChecked and fetchJSON", () => {
    it("throws with the status when the server refuses", async () => {
        statuses = [404];
        await expect(sendChecked(request())).rejects.toThrow("HTTP 404");
    });

    it("does not leak the query string (API key) in the error", async () => {
        statuses = [500];
        await expect(
            sendChecked(request("http://kavita/api/x?apiKey=SECRET")),
        ).rejects.not.toThrow("SECRET");
    });

    it("parses the JSON, also after a retry", async () => {
        statuses = [401, 200];
        await expect(fetchJSON<{ ok: boolean }>(request())).resolves.toEqual({
            ok: true,
        });
    });

    it("throws when the retry is refused again", async () => {
        statuses = [401, 401];
        await expect(fetchJSON(request())).rejects.toThrow("HTTP 401");
    });
});
