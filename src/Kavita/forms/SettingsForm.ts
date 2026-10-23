import {
    ButtonRow,
    Form,
    FormSectionElement,
    NavigationRow,
    Section,
} from "@paperback/types";
import { resetSettings } from "../settings";
import { HomeSettingsForm } from "./HomeSettingsForm";
import { SearchSettingsForm } from "./SearchSettingsForm";
import { ServerSettingsForm } from "./ServerSettingsForm";
import { UpdateSettingsForm } from "./UpdateSettingsForm";

export class SettingsForm extends Form {
    // Gives Application.Selector the concrete type instead of the polymorphic `this`
    private static asSelf(form: SettingsForm): SettingsForm {
        return form;
    }

    // Keeps the server URL and the API key, resets everything else
    async handleResetSettings(): Promise<void> {
        resetSettings();
        Application.invalidateDiscoverSections();
        this.reloadForm();
    }

    override getSections(): FormSectionElement[] {
        return [
            Section("settings", [
                NavigationRow("server", {
                    title: "Server",
                    form: new ServerSettingsForm(),
                }),
                NavigationRow("home", {
                    title: "Home",
                    form: new HomeSettingsForm(),
                }),
                NavigationRow("search", {
                    title: "Search & Lists",
                    form: new SearchSettingsForm(),
                }),
                NavigationRow("updates", {
                    title: "Updates",
                    form: new UpdateSettingsForm(),
                }),
            ]),
            Section("reset", [
                ButtonRow("resetSettings", {
                    title: "Reset Settings",
                    onSelect: Application.Selector(
                        SettingsForm.asSelf(this),
                        "handleResetSettings",
                    ),
                }),
            ]),
        ];
    }
}
