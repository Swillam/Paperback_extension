import { normalizeOrder } from "./utils/discoverOrder";
import { parsePageSize } from "./utils/numbers";

export function getKavitaUrl(): string {
    const rawUrl = Application.getState("kavita_url");

    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
        return "";
    }

    const url = rawUrl.trim().replace(/\/+$/, ""); // supprime les slashes de fin

    return url.endsWith("/api") ? url : `${url}/api`;
}

/**
 * The server URL as typed by the user (getKavitaUrl adds the /api suffix)
 */
export function getKavitaUrlSetting(): string {
    const rawUrl = Application.getState("kavita_url");
    return typeof rawUrl === "string" ? rawUrl : "";
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
    { id: "smart_filters", title: "Smart Filters" },
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

// Keys of the discover section order and of the update settings
export const DISCOVER_ORDER_KEY = "kavita_discover_order";
export const OPTIMIZE_UPDATES_KEY = "kavita_optimize_updates";
export const SKIP_UNREAD_KEY = "kavita_skip_unread";
export const SKIP_NEW_KEY = "kavita_skip_new";
export const SKIP_STATUS_KEY = "kavita_skip_status";

/**
 * Order of the discover section groups chosen by the user
 */
export function getDiscoverOrder(): string[] {
    return normalizeOrder(Application.getState(DISCOVER_ORDER_KEY));
}

/**
 * Whether the update check only fetches the series that changed (on by default)
 */
export function getOptimizeUpdates(): boolean {
    const value = Application.getState(OPTIMIZE_UPDATES_KEY);
    return typeof value === "boolean" ? value : true;
}

function readThreshold(key: string, fallback: number): number {
    const value: unknown = Application.getState(key);
    const raw: unknown = Array.isArray(value) ? value[0] : value;
    const parsed =
        typeof raw === "number"
            ? raw
            : typeof raw === "string"
              ? parseInt(raw)
              : NaN;
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
        ? parsed
        : fallback;
}

/**
 * Series with at least this many unread chapters (1 = any, else a percentage)
 * are not checked for updates. Defaults to 1, as before the setting existed.
 */
export function getSkipUnreadThreshold(): number {
    return readThreshold(SKIP_UNREAD_KEY, 1);
}

export function getSkipNewThreshold(): number {
    return readThreshold(SKIP_NEW_KEY, 0);
}

/**
 * Publication statuses ("Completed"...) that are not checked for updates
 */
export function getSkipStatuses(): string[] {
    const value = Application.getState(SKIP_STATUS_KEY);
    return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
}

/**
 * Clears every setting except the server URL and the API key
 */
export function resetSettings(): void {
    const keys = [
        "kavita_page_size",
        "kavita_enable_recursive_search",
        DISCOVER_ORDER_KEY,
        OPTIMIZE_UPDATES_KEY,
        SKIP_UNREAD_KEY,
        SKIP_NEW_KEY,
        SKIP_STATUS_KEY,
        ...DISCOVER_SECTION_TOGGLES.map((section) =>
            getDiscoverSectionStateKey(section.id),
        ),
    ];
    for (const key of keys) Application.setState(undefined, key);
}
