import {
    ButtonRow,
    Form,
    FormSectionElement,
    Section,
    ToggleRow,
} from "@paperback/types";
import {
    DISCOVER_ORDER_KEY,
    DISCOVER_SECTION_TOGGLES,
    getDiscoverOrder,
    getDiscoverSectionStateKey,
    isDiscoverSectionEnabled,
} from "../settings";
import { swapItems } from "../utils/discoverOrder";
import { State } from "../utils/StateUtil";
import { bindMoveHandlers, buildReorderableRows } from "./reorderable";

const titleFor = (id: string): string =>
    DISCOVER_SECTION_TOGGLES.find((section) => section.id === id)?.title ?? id;

/**
 * Which Discover sections are shown and in which order
 */
export class HomeSettingsForm extends Form {
    private toggles = DISCOVER_SECTION_TOGGLES.map((section) => ({
        ...section,
        state: new State<boolean>(
            this,
            getDiscoverSectionStateKey(section.id),
            isDiscoverSectionEnabled(section.id),
            // Make Paperback load the sections again
            () => Application.invalidateDiscoverSections(),
        ),
    }));

    // Gives Application.Selector the concrete type instead of the polymorphic `this`
    private static asSelf(form: HomeSettingsForm): HomeSettingsForm {
        return form;
    }

    constructor() {
        super();
        this.rebindHandlers();
    }

    private rebindHandlers(): void {
        bindMoveHandlers(this, getDiscoverOrder().length, (from, to) =>
            this.handleMove(from, to),
        );
    }

    private async handleMove(from: number, to: number): Promise<void> {
        const next = swapItems(getDiscoverOrder(), from, to);
        if (!next) return;

        Application.setState(next, DISCOVER_ORDER_KEY);
        Application.invalidateDiscoverSections();
        this.rebindHandlers();
        this.reloadForm();
    }

    async handleResetOrder(): Promise<void> {
        Application.setState(undefined, DISCOVER_ORDER_KEY);
        Application.invalidateDiscoverSections();
        this.rebindHandlers();
        this.reloadForm();
    }

    override getSections(): FormSectionElement[] {
        return [
            Section(
                { id: "visibility", header: "Home Sections" },
                this.toggles.map((section) =>
                    ToggleRow(`show_${section.id}`, {
                        title: section.title,
                        value: section.state.value,
                        onValueChange: section.state.selector,
                    }),
                ),
            ),
            Section(
                { id: "order", header: "Order" },
                buildReorderableRows(
                    this,
                    getDiscoverOrder(),
                    (id, i) => `${i + 1}. ${titleFor(id)}`,
                ),
            ),
            Section("reset_order", [
                ButtonRow("resetOrder", {
                    title: "Reset Order",
                    onSelect: Application.Selector(
                        HomeSettingsForm.asSelf(this),
                        "handleResetOrder",
                    ),
                }),
            ]),
        ];
    }
}
