import {
    ButtonRow,
    Form,
    FormSectionElement,
    InputRow,
    LabelRow,
    Section,
} from "@paperback/types";
import {
    getKavitaApiKey,
    getKavitaUrl,
    getKavitaUrlSetting,
} from "../settings";
import { checkConnection } from "../utils/connection";
import { State } from "../utils/StateUtil";

export class ServerSettingsForm extends Form {
    private url = new State<string>(this, "kavita_url", getKavitaUrlSetting());
    private apikey = new State<string>(
        this,
        "kavita_apikey",
        getKavitaApiKey(),
    );
    private connectionStatus = "";

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

    override getSections(): FormSectionElement[] {
        return [
            Section("info", [
                LabelRow("demo", {
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
                    isSecureEntry: true,
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
            ]),
        ];
    }
}
