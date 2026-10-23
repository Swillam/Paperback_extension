import { BasicRateLimiter } from "@paperback/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KavitaRateLimiter } from "../KavitaRateLimiter";

let sleeps: number[];

beforeEach(() => {
    sleeps = [];
    vi.stubGlobal("Application", {
        sleep: (seconds: number) => {
            sleeps.push(seconds);
            return Promise.resolve();
        },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// The options of the extension
const options = {
    numberOfRequests: 15,
    bufferInterval: 10,
    ignoreImages: true,
};
const request = (url: string) => ({ url, method: "GET" });
const cover = (id: number) =>
    `http://kavita/api/image/series-cover?seriesId=${id}&apiKey=key`;
const api = (id: number) => `http://kavita/api/Series/${id}`;

async function send(limiter: BasicRateLimiter, urls: string[]): Promise<void> {
    for (const url of urls) await limiter.interceptRequest(request(url));
}

describe("rate limiter and Kavita covers", () => {
    it("Paperback's own limiter counts the covers (the defect)", async () => {
        const limiter = new BasicRateLimiter("main", options);
        await send(
            limiter,
            Array.from({ length: 40 }, (_, i) => cover(i)),
        );
        expect(sleeps.length).toBeGreaterThan(0);
    });

    it("does not count the covers", async () => {
        const limiter = new KavitaRateLimiter("main", options);
        await send(
            limiter,
            Array.from({ length: 200 }, (_, i) => cover(i)),
        );
        expect(sleeps).toEqual([]);
    });

    it("does not count chapter pages, also with their FAKE url", async () => {
        const limiter = new KavitaRateLimiter("main", options);
        const real = (i: number) =>
            `http://kavita/api/Reader/image?chapterId=1&page=${i}&apiKey=key&extractPdf=true`;
        await send(
            limiter,
            Array.from(
                { length: 100 },
                (_, i) => `FAKE*/${i}?*REAL*${real(i)}`,
            ),
        );
        expect(sleeps).toEqual([]);
    });

    it("still limits the API calls", async () => {
        const limiter = new KavitaRateLimiter("main", options);
        await send(
            limiter,
            Array.from({ length: 40 }, (_, i) => api(i)),
        );
        expect(sleeps.length).toBeGreaterThan(0);
    });

    it("covers do not use up the budget of the API calls", async () => {
        const limiter = new KavitaRateLimiter("main", options);
        await send(
            limiter,
            Array.from({ length: 100 }, (_, i) => cover(i)),
        );
        await send(
            limiter,
            Array.from({ length: 10 }, (_, i) => api(i)),
        );
        expect(sleeps).toEqual([]);
    });
});
