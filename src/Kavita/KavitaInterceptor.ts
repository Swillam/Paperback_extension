import {
    PaperbackInterceptor,
    Request,
    Response,
} from "@paperback/types";

import { getKavitaApiKey } from "./settings";

// Intercepts all the requests and responses and allows you to make changes to them
export class KavitaInterceptor extends PaperbackInterceptor {

    authorization = '';

    async isServerAvailable(): Promise<boolean> {
        await this.getAuthorizationString();
        return this.authorization.startsWith('Bearer ');
    }

    async getAuthorizationString(): Promise<string> {
        if (this.authorization === '') {
            this.authorization = 'Bearer ' + getKavitaApiKey();
        }

        return this.authorization;
    }

    clearAuthorizationString(): void {
        this.authorization = '';
    }

    override async interceptRequest(request: Request): Promise<Request> {
        request.headers = {
            ...request.headers,
            'Content-Type': 'application/json',

            'Authorization': await this.getAuthorizationString()
        }

        if (request.url.startsWith('FAKE*')) {
            request.url = request.url.split('*REAL*').pop() ?? '';
        }

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