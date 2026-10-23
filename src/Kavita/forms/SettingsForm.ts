// TODO: Rework

import {
    ButtonRow,
    Form,
    FormSectionElement,
    InputRow,
    LabelRow,
    NavigationRow,
    Section,
    ToggleRow,
} from "@paperback/types";
import {
    DISCOVER_SECTION_TOGGLES,
    getDiscoverSectionStateKey,
    getKavitaApiKey,
    getKavitaEnableRecursiveSearch,
    getKavitaPageSize,
    getKavitaUrl,
    isDiscoverSectionEnabled,
} from "../settings";
import { checkConnection } from "../utils/connection";
import { State } from "../utils/StateUtil";

export class SettingsForm extends Form {
    override getSections(): FormSectionElement[] {
        return [
            Section("server", [
                NavigationRow("server", {
                    title: "Server Settings",
                    form: new ServerSettingsForm(),
                }),
            ]),
        ];
    }
}

class ServerSettingsForm extends Form {
    private url: State<string>;
    private apikey: State<string>;
    private pageSize: State<string>;
    private enableRecursiveSearch: State<boolean>;
    private connectionStatus = "";
    private discoverToggles = DISCOVER_SECTION_TOGGLES.map((section) => ({
        ...section,
        state: new State<boolean>(
            this,
            getDiscoverSectionStateKey(section.id),
            isDiscoverSectionEnabled(section.id),
        ),
    }));

    // Gives Application.Selector the concrete type instead of the polymorphic `this`
    private static asSelf(form: ServerSettingsForm): ServerSettingsForm {
        return form;
    }

    async testConnection(): Promise<void> {
        this.connectionStatus = "Testing...";
        this.reloadForm();
        this.connectionStatus = await checkConnection(
            getKavitaUrl(),
            getKavitaApiKey(),
        );
        this.reloadForm();
    }

    constructor() {
        super();
        this.url = new State<string>(this, "kavita_url", getKavitaUrl());
        this.apikey = new State<string>(
            this,
            "kavita_apikey",
            getKavitaApiKey(),
        );
        this.pageSize = new State<string>(
            this,
            "kavita_page_size",
            getKavitaPageSize(),
        );
        this.enableRecursiveSearch = new State<boolean>(
            this,
            "kavita_enable_recursive_search",
            getKavitaEnableRecursiveSearch(),
        );
    }

    override getSections(): FormSectionElement[] {
        return [
            Section("info", [
                LabelRow("", {
                    title: "Demo Server",
                    subtitle:
                        "Server URL: https://demo.kavitareader.com\nUsername: demouser\nPassword: Demouser64\n\nNote: Values are case-sensitive.",
                    value: "",
                }),
            ]),

            Section("server", [
                InputRow("url", {
                    title: "Server URL",
                    value: this.url.value,
                    onValueChange: this.url.selector,
                }),
                InputRow("apikey", {
                    title: "API Key",
                    value: this.apikey.value,
                    onValueChange: this.apikey.selector,
                }),
                ButtonRow("testConnection", {
                    title: "Test Connection",
                    onSelect: Application.Selector(
                        ServerSettingsForm.asSelf(this),
                        "testConnection",
                    ),
                }),
                ...(this.connectionStatus === ""
                    ? []
                    : [
                          LabelRow("connectionStatus", {
                              title: "Status",
                              subtitle: this.connectionStatus,
                          }),
                      ]),
                InputRow("pageSize", {
                    title: "Page Size (1-200)",
                    value: this.pageSize.value,
                    onValueChange: this.pageSize.selector,
                }),
            ]),
            Section(
                "discover",
                this.discoverToggles.map((section) =>
                    ToggleRow(`discover_${section.id}`, {
                        title: section.title,
                        value: section.state.value,
                        onValueChange: section.state.selector,
                    }),
                ),
            ),
            Section("Search", [
                ToggleRow("enableRecursiveSearch", {
                    title: "Enable Recursive Search",
                    value: this.enableRecursiveSearch.value,
                    onValueChange: this.enableRecursiveSearch.selector,
                    subtitle:
                        "Enables searching for tags and persons in the title search.",
                }),
            ]),
        ];
    }
}
