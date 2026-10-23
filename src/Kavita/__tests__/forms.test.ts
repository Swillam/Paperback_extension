import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeSettingsForm } from "../forms/HomeSettingsForm";
import { SearchSettingsForm } from "../forms/SearchSettingsForm";
import { ServerSettingsForm } from "../forms/ServerSettingsForm";
import { SettingsForm } from "../forms/SettingsForm";
import { UpdateSettingsForm } from "../forms/UpdateSettingsForm";

// Rows carry their properties directly (FormItemElement & Props)
type Element = { id: string; type: string } & Record<string, unknown>;

let state: Record<string, unknown>;
let invalidated: number;

beforeEach(() => {
    state = {
        kavita_url: "https://kavita.example",
        kavita_apikey: "secret-key",
    };
    invalidated = 0;
    vi.stubGlobal("Application", {
        getState: (key: string) => state[key],
        setState: (value: unknown, key: string) => {
            if (value === undefined) delete state[key];
            else state[key] = value;
        },
        invalidateDiscoverSections: () => {
            invalidated++;
        },
        // the selector is only an opaque id for the app: keep the method name
        Selector: (_object: unknown, method: string) => method,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Rows of every section, flattened
function rows(form: { getSections: () => unknown[] }): Element[] {
    return form.getSections().flatMap((section) => {
        const items = (section as { items: unknown[] | (() => unknown[]) })
            .items;
        const list = typeof items === "function" ? items() : items;
        return list as Element[];
    });
}

const row = (form: { getSections: () => unknown[] }, id: string): Element => {
    const found = rows(form).find((r) => r.id === id);
    if (!found) throw new Error(`no row ${id}`);
    return found;
};

describe("SettingsForm", () => {
    it("has one entry per theme and a reset button", () => {
        const form = new SettingsForm();
        expect(rows(form).map((r) => r.id)).toEqual([
            "server",
            "home",
            "search",
            "updates",
            "resetSettings",
        ]);
    });

    it("resets the settings but keeps the server and refreshes Discover", async () => {
        state["kavita_page_size"] = 50;
        state["kavita_show_ondeck"] = false;
        state["kavita_skip_unread"] = ["50"];
        const form = new SettingsForm();
        const reload = vi
            .spyOn(form, "reloadForm")
            .mockImplementation(() => undefined);

        await form.handleResetSettings();

        expect(state).toEqual({
            kavita_url: "https://kavita.example",
            kavita_apikey: "secret-key",
        });
        expect(invalidated).toBe(1);
        expect(reload).toHaveBeenCalled();
    });
});

describe("ServerSettingsForm", () => {
    it("hides the API key", () => {
        const apikey = row(new ServerSettingsForm(), "apikey");
        expect(apikey["isSecureEntry"]).toBe(true);
        expect(
            row(new ServerSettingsForm(), "url")["isSecureEntry"],
        ).toBeUndefined();
    });

    it("shows the URL as typed, without the /api suffix added internally", () => {
        expect(row(new ServerSettingsForm(), "url")["value"]).toBe(
            "https://kavita.example",
        );
    });

    it("shows the connection status only once there is one", () => {
        const form = new ServerSettingsForm();
        expect(rows(form).map((r) => r.id)).not.toContain("connectionStatus");
    });
});

describe("HomeSettingsForm", () => {
    it("has a toggle per section and one row per group in the order", () => {
        const form = new HomeSettingsForm();
        const ids = rows(form).map((r) => r.id);
        expect(ids.filter((id) => id.startsWith("show_"))).toHaveLength(6);
        expect(ids.filter((id) => id.startsWith("order_"))).toHaveLength(6);
        // first item cannot go up, last cannot go down
        expect(ids).not.toContain("move_up_0");
        expect(ids).toContain("move_up_1");
        expect(ids).toContain("move_down_0");
        expect(ids).not.toContain("move_down_5");
    });

    it("moves a section down and tells Paperback to reload the sections", async () => {
        const form = new HomeSettingsForm();
        const reload = vi
            .spyOn(form, "reloadForm")
            .mockImplementation(() => undefined);

        await (form as unknown as Record<string, () => Promise<void>>)[
            "moveDown_0"
        ]();

        expect(state["kavita_discover_order"]).toEqual([
            "latest_updates",
            "ondeck",
            "recently_added",
            "tag_sections",
            "libraries",
            "smart_filters",
        ]);
        expect(invalidated).toBe(1);
        expect(reload).toHaveBeenCalled();
    });

    it("ignores a move past the ends", async () => {
        const form = new HomeSettingsForm();
        await (form as unknown as Record<string, () => Promise<void>>)[
            "moveUp_0"
        ]();
        expect(state["kavita_discover_order"]).toBeUndefined();
        expect(invalidated).toBe(0);
    });

    it("resets the order", async () => {
        state["kavita_discover_order"] = ["libraries"];
        const form = new HomeSettingsForm();
        vi.spyOn(form, "reloadForm").mockImplementation(() => undefined);
        await form.handleResetOrder();
        expect(state["kavita_discover_order"]).toBeUndefined();
        expect(invalidated).toBe(1);
    });

    it("refreshes Discover when a section is toggled", async () => {
        const form = new HomeSettingsForm();
        vi.spyOn(form, "reloadForm").mockImplementation(() => undefined);
        // the toggle states are private: reach the one of the first section
        const toggles = (
            form as unknown as {
                toggles: {
                    id: string;
                    state: { updateValue: (v: boolean) => Promise<void> };
                }[];
            }
        ).toggles;
        await toggles[0].state.updateValue(false);
        expect(state["kavita_show_ondeck"]).toBe(false);
        expect(invalidated).toBe(1);
    });
});

describe("SearchSettingsForm", () => {
    it("starts from the validated page size", () => {
        state["kavita_page_size"] = "abc";
        expect(row(new SearchSettingsForm(), "pageSize")["value"]).toBe(20);
        state["kavita_page_size"] = "40";
        expect(row(new SearchSettingsForm(), "pageSize")["value"]).toBe(40);
    });

    it("keeps the stepper within the allowed page sizes", () => {
        const props = row(new SearchSettingsForm(), "pageSize");
        expect(props["minValue"]).toBe(10);
        expect(props["maxValue"]).toBe(200);
    });
});

describe("UpdateSettingsForm", () => {
    it("shows the current defaults", () => {
        const form = new UpdateSettingsForm();
        expect(row(form, "optimizeUpdates")["value"]).toBe(true);
        expect(row(form, "skipUnread")["value"]).toEqual(["1"]);
        expect(row(form, "skipNew")["value"]).toEqual(["0"]);
        expect(row(form, "skipStatuses")["value"]).toEqual([]);
    });

    it("offers the publication statuses", () => {
        const options = row(new UpdateSettingsForm(), "skipStatuses")[
            "options"
        ] as { id: string }[];
        expect(options.map((o) => o.id)).toContain("Completed");
    });

    it("shows the stored choices", () => {
        state["kavita_skip_unread"] = ["50"];
        state["kavita_skip_status"] = ["Completed"];
        const form = new UpdateSettingsForm();
        expect(row(form, "skipUnread")["value"]).toEqual(["50"]);
        expect(String(row(form, "skipUnread")["subtitle"])).toContain("50%");
        expect(row(form, "skipStatuses")["value"]).toEqual(["Completed"]);
    });
});
