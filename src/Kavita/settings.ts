import { parsePageSize } from "./utils/numbers";

export function getKavitaUrl(): string {
    const rawUrl = Application.getState("kavita_url");

    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
        return "";
    }

    const url = rawUrl.trim().replace(/\/+$/, ""); // supprime les slashes de fin

    return url.endsWith("/api") ? url : `${url}/api`;
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
    return String(getKavitaPageSizeNumber());
}

export function getKavitaPageSizeNumber(): number {
    return parsePageSize(Application.getState("kavita_page_size"));
}

export function setKavitaPageSize(pageSize: string): void {
    Application.setState(pageSize, "kavita_page_size");
}

export function getKavitaEnableRecursiveSearch(): boolean {
    const enableRecursiveSearch = Application.getState(
        "kavita_enable_recursive_search",
    ) as boolean | undefined;
    if (enableRecursiveSearch === undefined) {
        return false;
    }
    return enableRecursiveSearch;
}

export function setKavitaEnableRecursiveSearch(
    enableRecursiveSearch: boolean,
): void {
    Application.setState(
        enableRecursiveSearch,
        "kavita_enable_recursive_search",
    );
}

export const DISCOVER_SECTION_TOGGLES = [
    { id: "ondeck", title: "On Deck" },
    { id: "latest_updates", title: "Latest Updates" },
    { id: "recently_added", title: "Recently Added" },
    { id: "tag_sections", title: "Tag Sections" },
    { id: "libraries", title: "Library Sections" },
] as const;

export function getDiscoverSectionStateKey(id: string): string {
    return `kavita_show_${id}`;
}

/**
 * Whether a discover section is shown (all of them are by default)
 */
export function isDiscoverSectionEnabled(id: string): boolean {
    const value = Application.getState(getDiscoverSectionStateKey(id));
    return typeof value === "boolean" ? value : true;
}
