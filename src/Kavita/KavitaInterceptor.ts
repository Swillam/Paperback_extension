import { PaperbackInterceptor, Request, Response } from "@paperback/types";
import { getKavitaApiKey, getKavitaUrl } from "./settings";
import { fetchJSON } from "./utils/CommonUtils";

// Intercepts all the requests and responses and allows you to make changes to them
export class KavitaInterceptor extends PaperbackInterceptor {
    authorization = "";

    async isServerAvailable(): Promise<boolean> {
        await this.getAuthorizationString();
        return this.authorization.startsWith("Bearer ");
    }

    async getAuthorizationString(): Promise<string> {
        if (this.authorization === "") {
            const token = await this.getAuthorization();

            this.authorization = token;
        }

        return this.authorization;
    }

    async getAuthorization(): Promise<string> {
        const kavitaAPI = getKavitaApiKey();
        const kavitaURL = getKavitaUrl();

        const request = {
            url: `${kavitaURL}/Plugin/authenticate?apiKey=${kavitaAPI}&pluginName=Kavya`,
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
        void response;

        return data;
    }
}
