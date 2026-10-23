import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KavitaInterceptor } from "../KavitaInterceptor";
import { isImageRequest } from "../utils/images";

let state: Record<string, unknown>;
let signIns: number;
let signInStatus: number;
let signInDelayMs: number;

beforeEach(() => {
    state = { kavita_url: "http://kavita", kavita_apikey: "key" };
    signIns = 0;
    signInStatus = 200;
    signInDelayMs = 0;
    vi.stubGlobal("Application", {
        getState: (k: string) => state[k],
        scheduleRequest: async (request: { url: string }) => {
            if (request.url.includes("/Plugin/authenticate")) {
                signIns++;
                if (signInDelayMs > 0) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, signInDelayMs),
                    );
                }
                return [
                    { status: signInStatus },
                    JSON.stringify({ token: `token-${signIns}` }),
                ];
            }
            return [{ status: 200 }, "{}"];
        },
        arrayBufferToUTF8String: (buffer: string) => buffer,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const request = (url: string) => ({
    url,
    method: "GET",
    headers: {} as Record<string, string>,
});
const cover = "http://kavita/api/image/series-cover?seriesId=1&apiKey=key";

describe("isImageRequest", () => {
    it("recognises covers and chapter pages carrying the API key", () => {
        expect(isImageRequest(cover)).toBe(true);
        expect(
            isImageRequest(
                "http://k/api/Reader/image?chapterId=1&page=2&apiKey=key&extractPdf=true",
            ),
        ).toBe(true);
    });

    it("does not skip the sign-in when the key is missing or the url is not an image", () => {
        expect(
            isImageRequest("http://k/api/image/series-cover?seriesId=1"),
        ).toBe(false);
        expect(
            isImageRequest(
                "http://k/api/image/series-cover?seriesId=1&apiKey=",
            ),
        ).toBe(false);
        expect(isImageRequest("http://k/api/Series/1?apiKey=key")).toBe(false);
    });
});

describe("KavitaInterceptor", () => {
    it("signs in once for a screen full of requests", async () => {
        signInDelayMs = 20;
        const interceptor = new KavitaInterceptor("main");
        const results = await Promise.all(
            Array.from({ length: 50 }, (_, i) =>
                interceptor.interceptRequest(
                    request(`http://kavita/api/Series/${i}`),
                ),
            ),
        );
        expect(signIns).toBe(1);
        expect(
            new Set(results.map((r) => r.headers?.["Authorization"])).size,
        ).toBe(1);
        expect(results[0]?.headers?.["Authorization"]).toBe("Bearer token-1");
    });

    it("does not sign in for images, whatever the sign-in does", async () => {
        signInStatus = 500;
        const interceptor = new KavitaInterceptor("main");
        const results = await Promise.all(
            Array.from({ length: 50 }, () =>
                interceptor.interceptRequest(request(cover)),
            ),
        );
        expect(signIns).toBe(0);
        expect(
            results.every((r) => r.headers?.["Authorization"] === undefined),
        ).toBe(true);
    });

    it("still fails a data request when the sign-in is refused", async () => {
        signInStatus = 401;
        const interceptor = new KavitaInterceptor("main");
        await expect(
            interceptor.interceptRequest(request("http://kavita/api/Series/1")),
        ).rejects.toThrow("HTTP 401");
    });

    it("tries again after a failed sign-in instead of keeping the failure", async () => {
        signInStatus = 401;
        const interceptor = new KavitaInterceptor("main");
        await interceptor
            .interceptRequest(request("http://kavita/api/Series/1"))
            .catch(() => undefined);
        signInStatus = 200;
        const result = await interceptor.interceptRequest(
            request("http://kavita/api/Series/1"),
        );
        expect(result.headers?.["Authorization"]).toBe("Bearer token-2");
    });

    it("keeps restoring the real url of chapter pages, without signing in", async () => {
        const interceptor = new KavitaInterceptor("main");
        const real =
            "http://kavita/api/Reader/image?chapterId=9&page=3&apiKey=key&extractPdf=true";
        const result = await interceptor.interceptRequest(
            request(`FAKE*/3?*REAL*${real}`),
        );
        expect(result.url).toBe(real);
        expect(signIns).toBe(0);
    });

    it("restores the real url and signs in for other FAKE urls", async () => {
        const interceptor = new KavitaInterceptor("main");
        const result = await interceptor.interceptRequest(
            request("FAKE*/0?*REAL*http://kavita/api/Series/1"),
        );
        expect(result.url).toBe("http://kavita/api/Series/1");
        expect(result.headers?.["Authorization"]).toBe("Bearer token-1");
    });

    it("does not sign in again for the authenticate request itself", async () => {
        const interceptor = new KavitaInterceptor("main");
        const result = await interceptor.interceptRequest(
            request("http://kavita/api/Plugin/authenticate?apiKey=key"),
        );
        expect(result.headers?.["Authorization"]).toBeUndefined();
        expect(signIns).toBe(0);
    });

    it("signs in again after the API key changes", async () => {
        const interceptor = new KavitaInterceptor("main");
        await interceptor.interceptRequest(
            request("http://kavita/api/Series/1"),
        );
        state["kavita_apikey"] = "other";
        const result = await interceptor.interceptRequest(
            request("http://kavita/api/Series/1"),
        );
        expect(signIns).toBe(2);
        expect(result.headers?.["Authorization"]).toBe("Bearer token-2");
    });

    it("signs in again after a 401 response", async () => {
        const interceptor = new KavitaInterceptor("main");
        await interceptor.interceptRequest(
            request("http://kavita/api/Series/1"),
        );
        await interceptor.interceptResponse(
            request("http://kavita/api/Series/1"),
            { status: 401 } as never,
            new ArrayBuffer(0),
        );
        const result = await interceptor.interceptRequest(
            request("http://kavita/api/Series/1"),
        );
        expect(signIns).toBe(2);
        expect(result.headers?.["Authorization"]).toBe("Bearer token-2");
    });
});
