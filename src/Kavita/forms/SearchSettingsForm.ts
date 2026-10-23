import {
    Form,
    FormSectionElement,
    Section,
    StepperRow,
    ToggleRow,
} from "@paperback/types";
import {
    getKavitaEnableRecursiveSearch,
    getKavitaPageSizeNumber,
} from "../settings";
import { MAX_PAGE_SIZE } from "../utils/numbers";
import { State } from "../utils/StateUtil";

export class SearchSettingsForm extends Form {
    private pageSize = new State<number>(
        this,
        "kavita_page_size",
        getKavitaPageSizeNumber(),
    );
    private enableRecursiveSearch = new State<boolean>(
        this,
        "kavita_enable_recursive_search",
        getKavitaEnableRecursiveSearch(),
    );

    override getSections(): FormSectionElement[] {
        return [
            Section("lists", [
                StepperRow("pageSize", {
                    title: "Page Size",
                    subtitle: `${this.pageSize.value} items per page in Discover and search`,
                    value: this.pageSize.value,
                    minValue: 10,
                    maxValue: MAX_PAGE_SIZE,
                    stepValue: 10,
                    loopOver: false,
                    onValueChange: this.pageSize.selector,
                }),
            ]),
            Section("search", [
                ToggleRow("enableRecursiveSearch", {
                    title: "Enable Recursive Search",
                    subtitle:
                        "Also finds series through the tags and people matching the title you type.",
                    value: this.enableRecursiveSearch.value,
                    onValueChange: this.enableRecursiveSearch.selector,
                }),
            ]),
        ];
    }
}
