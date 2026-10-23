import { Request } from "@paperback/types";

// common constants
export const KAVITA_PUBLICATION_STATUS: Record<number, string> = {
    0: "Ongoing",
    1: "Hiatus",
    2: "Completed",
    3: "Cancelled",
    4: "Ended",
};

/**
 * Fetches and parses JSON response from API
 */
export async function fetchJSON<T>(request: Request): Promise<T> {
    const [response, buffer] = await Application.scheduleRequest(request);
    if (response.status < 200 || response.status >= 300) {
        throw new Error(
            `Kavita request failed (HTTP ${response.status}) for ${request.url.split("?")[0]}`,
        );
    }
    const data = Application.arrayBufferToUTF8String(buffer);
    return (typeof data === "string" ? JSON.parse(data) : data) as T;
}
