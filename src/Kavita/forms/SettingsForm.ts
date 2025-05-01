// TODO: Rework

import {
    ButtonRow,
    Form,
    InputRow,
    LabelRow,
    NavigationRow,
    Section,
    ToggleRow,
} from "@paperback/types";
import { State } from "../utils/StateUtil";
import { getKavitaApiKey, getKavitaEnableRecursiveSearch, getKavitaPageSize, getKavitaUrl, setKavitaEnableRecursiveSearch } from "../settings";

export class SettingsForm extends Form {
    override getSections(): Application.FormSectionElement[] {
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
    private url = State<string>;
    private apikey = State<string>;
    private pageSize = State<string>;
    private enableRecursiveSearch = State<boolean>;

    constructor() {
        super();
        this.url = new State<string>(this, "kavita_url", getKavitaUrl());
        this.apikey = new State<string>(this, "kavita_apikey", getKavitaApiKey());
        this.pageSize = new State<string>(this, "kavita_page_size", getKavitaPageSize());
        this.enableRecursiveSearch = new State<boolean>(this, "kavita_enable_recursive_search", getKavitaEnableRecursiveSearch());
    }

    override getSections(): Application.FormSectionElement[] {
        return [
            Section("info",[
                LabelRow("", {
                    title: "Demo Server",
                    subtitle: "Server URL: https://demo.kavitareader.com\nUsername: demouser\nPassword: Demouser64\n\nNote: Values are case-sensitive.",
                    value: ""
                })
            ]),

            Section("server", [
                InputRow("url", {
                    title: "Server URL",
                    value: this.url.value,
                    onValueChange: this.url.selector
                }),
                InputRow("apikey", {
                    title: "API Key",
                    value: this.apikey.value,
                    onValueChange: this.apikey.selector
                }),
                InputRow("pageSize", {
                    title: "Page Size",
                    value: this.pageSize.value,
                    onValueChange: this.pageSize.selector,
                    keyboardType: "numeric",
                }),
            ]),
            Section("Search", [
                ToggleRow("enableRecursiveSearch", {
                    title: "Enable Recursive Search",
                    value: this.enableRecursiveSearch.value,
                    onValueChange: this.enableRecursiveSearch.selector,
                    subtitle: "Enables searching for tags and persons in the title search.",
                }),
            ]),
        ];
    }
}
