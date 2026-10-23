import { Request, Response } from "@paperback/types";

// common constants
export const KAVITA_PUBLICATION_STATUS: Record<number, string> = {
    0: "Ongoing",
    1: "Hiatus",
    2: "Completed",
    3: "Cancelled",
    4: "Ended",
};

/**
 * Sends a request. A 401 means the token expired (the interceptor drops it when
 * it sees the response): send the request once more, which signs in again.
 */
export async function sendRequest(
    request: Request,
): Promise<[Response, ArrayBuffer]> {
    const result = await Application.scheduleRequest(request);
    if (
        result[0].status === 401 &&
        !request.url.includes("/Plugin/authenticate")
    ) {
        return Application.scheduleRequest(request);
    }
    return result;
}

/**
 * Sends a request and throws when the server does not answer with a 2xx.
 */
export async function sendChecked(
    request: Request,
): Promise<[Response, ArrayBuffer]> {
    const result = await sendRequest(request);
    const status = result[0].status;
    if (status < 200 || status >= 300) {
        throw new Error(
            `Kavita request failed (HTTP ${status}) for ${request.url.split("?")[0]}`,
        );
    }
    return result;
}

/**
 * Fetches and parses JSON response from API
 */
export async function fetchJSON<T>(request: Request): Promise<T> {
    const [, buffer] = await sendChecked(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    return (typeof data === "string" ? JSON.parse(data) : data) as T;
}
