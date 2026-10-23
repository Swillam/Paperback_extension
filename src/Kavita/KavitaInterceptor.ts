import { PaperbackInterceptor, Request, Response } from "@paperback/types";
import { getKavitaApiKey, getKavitaUrl } from "./settings";
import { fetchJSON } from "./utils/CommonUtils";
import { isImageRequest } from "./utils/images";

// Intercepts all the requests and responses and allows you to make changes to them
export class KavitaInterceptor extends PaperbackInterceptor {
    authorization = "";
    // url + api key the cached token was issued for
    private authorizationKey = "";
    // Sign-in in progress, shared by the requests that arrive meanwhile
    private pendingAuthorization: Promise<string> | undefined;

    async isServerAvailable(): Promise<boolean> {
        await this.getAuthorizationString();
        return this.authorization.startsWith("Bearer ");
    }

    async getAuthorizationString(): Promise<string> {
        // Drop the cached token when the server or the API key changed
        const currentKey = `${getKavitaUrl()}|${getKavitaApiKey()}`;
        if (currentKey !== this.authorizationKey) {
            this.authorization = "";
            this.pendingAuthorization = undefined;
            this.authorizationKey = currentKey;
        }

        if (this.authorization !== "") return this.authorization;

        // A screen starts dozens of requests at once: sign in a single time and
        // let them all wait for it, instead of one sign-in per request
        this.pendingAuthorization ??= this.getAuthorization()
            .then((token) => {
                this.authorization = token;
                return token;
            })
            .finally(() => {
                this.pendingAuthorization = undefined;
            });

        return this.pendingAuthorization;
    }

    async getAuthorization(): Promise<string> {
        const kavitaAPI = getKavitaApiKey();
        const kavitaURL = getKavitaUrl();

        const request = {
            url: `${kavitaURL}/Plugin/authenticate?apiKey=${kavitaAPI}&pluginName=Kavita`,
            method: "POST",
        };

        const response = await fetchJSON<Kavita.AuthenticateResponse>(request);
        const token = response.token;

        return token ? `Bearer ${token}` : "";
    }

    clearAuthorizationString(): void {
        this.authorization = "";
    }

    override async interceptRequest(request: Request): Promise<Request> {
        // if the request is /Plugin/authenticate then return the request
        if (request.url.includes("/Plugin/authenticate")) {
            return request;
        }

        // Page images get a unique FAKE*...*REAL* url: restore the real one first
        if (request.url.startsWith("FAKE*")) {
            request.url = request.url.split("*REAL*").pop() ?? "";
        }

        // Images carry the API key in their url: they must not wait for, or
        // fail with, a sign-in they do not need
        if (isImageRequest(request.url)) return request;

        request.headers = {
            ...request.headers,
            "Content-Type": "application/json",

            Authorization: await this.getAuthorizationString(),
        };

        return request;
    }

    override async interceptResponse(
        request: Request,
        response: Response,
        data: ArrayBuffer,
    ): Promise<ArrayBuffer> {
        void request;

        // Token expired or revoked: drop the cache so the next request re-authenticates
        if (response.status === 401) {
            this.clearAuthorizationString();
        }

        return data;
    }
}
