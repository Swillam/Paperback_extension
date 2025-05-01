

export function getKavitaUrl(): string {
    const url = Application.getState("kavita_url") as string | undefined;
    if (url === undefined) {
        return "";
    }
    return url+"/api";
}

export function setKavitaUrl(url: string): void {
    Application.setState(url, "kavita_url");
}

export function getKavitaApiKey(): string {
    const apiKey = Application.getState("kavita_apikey") as string | undefined;
    if (apiKey === undefined) {
        return "";
    }
    return apiKey;
}

export function setKavitaApiKey(apiKey: string): void {
    Application.setState(apiKey, "kavita_apikey");
}

export function getKavitaPageSize(): string {
    const pageSize = Application.getState("kavita_page_size") as string | undefined;
    if (pageSize === undefined) {
        return "20";
    }
    return pageSize;
}

export function setKavitaPageSize(pageSize: string): void {
    Application.setState(pageSize, "kavita_page_size");
}

export function getKavitaEnableRecursiveSearch(): boolean {
    const enableRecursiveSearch = Application.getState("kavita_enable_recursive_search") as boolean | undefined;
    if (enableRecursiveSearch === undefined) {
        return false;
    }
    return enableRecursiveSearch;
}

export function setKavitaEnableRecursiveSearch(enableRecursiveSearch: boolean): void {
    Application.setState(enableRecursiveSearch, "kavita_enable_recursive_search");
}