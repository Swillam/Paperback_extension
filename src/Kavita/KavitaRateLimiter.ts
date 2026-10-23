import { BasicRateLimiter, Request } from "@paperback/types";
import { isImageRequest } from "./utils/images";

/**
 * Paperback's BasicRateLimiter only lets through the images whose url ends with
 * a file extension (.png, .jpg...). Kavita's covers and pages have none
 * (/api/image/series-cover?...), so each of them counted in the limit, and a
 * screen of covers waited behind it for tens of seconds. Images carrying the
 * API key are not counted here; the API calls still are.
 */
export class KavitaRateLimiter extends BasicRateLimiter {
    override async interceptRequest(request: Request): Promise<Request> {
        if (isImageRequest(request.url)) return request;
        return super.interceptRequest(request);
    }
}
