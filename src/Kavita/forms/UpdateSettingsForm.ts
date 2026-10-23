import {
    Form,
    FormSectionElement,
    Section,
    SelectRow,
    ToggleRow,
} from "@paperback/types";
import {
    getOptimizeUpdates,
    getSkipNewThreshold,
    getSkipStatuses,
    getSkipUnreadThreshold,
    OPTIMIZE_UPDATES_KEY,
    SKIP_NEW_KEY,
    SKIP_STATUS_KEY,
    SKIP_UNREAD_KEY,
} from "../settings";
import { KAVITA_PUBLICATION_STATUS } from "../utils/CommonUtils";
import { State } from "../utils/StateUtil";
import { describeSkip, skipThresholdOptions } from "../utils/updates";

const STATUS_OPTIONS = Object.values(KAVITA_PUBLICATION_STATUS).map(
    (status) => ({ id: status, title: status }),
);

/**
 * How Paperback's library update checks the Kavita series
 */
export class UpdateSettingsForm extends Form {
    private optimize = new State<boolean>(
        this,
        OPTIMIZE_UPDATES_KEY,
        getOptimizeUpdates(),
    );
    private skipUnread = new State<string[]>(this, SKIP_UNREAD_KEY, [
        String(getSkipUnreadThreshold()),
    ]);
    private skipNew = new State<string[]>(this, SKIP_NEW_KEY, [
        String(getSkipNewThreshold()),
    ]);
    private skipStatuses = new State<string[]>(
        this,
        SKIP_STATUS_KEY,
        getSkipStatuses(),
    );

    override getSections(): FormSectionElement[] {
        const unread = parseInt(this.skipUnread.value[0] ?? "0");
        const added = parseInt(this.skipNew.value[0] ?? "0");

        return [
            Section(
                {
                    id: "updates",
                    footer: "Affects how Paperback's library update checks your Kavita series.",
                },
                [
                    ToggleRow("optimizeUpdates", {
                        title: "Optimized Updates",
                        subtitle:
                            "Check all series in batches and only fetch the ones with a new chapter",
                        value: this.optimize.value,
                        onValueChange: this.optimize.selector,
                    }),
                    SelectRow("skipUnread", {
                        title: "Skip by Unread Chapters",
                        subtitle: describeSkip(unread, "unread"),
                        value: this.skipUnread.value,
                        options: skipThresholdOptions("unread"),
                        minItemCount: 1,
                        maxItemCount: 1,
                        onValueChange: this.skipUnread.selector,
                    }),
                    SelectRow("skipNew", {
                        title: "Skip by New Chapters",
                        subtitle: describeSkip(added, "new"),
                        value: this.skipNew.value,
                        options: skipThresholdOptions("new"),
                        minItemCount: 1,
                        maxItemCount: 1,
                        onValueChange: this.skipNew.selector,
                    }),
                    SelectRow("skipStatuses", {
                        title: "Skip by Status",
                        subtitle:
                            this.skipStatuses.value.length > 0
                                ? `Skipping: ${this.skipStatuses.value.join(", ")}`
                                : "Pick the statuses to skip",
                        value: this.skipStatuses.value,
                        options: STATUS_OPTIONS,
                        minItemCount: 0,
                        maxItemCount: STATUS_OPTIONS.length,
                        onValueChange: this.skipStatuses.selector,
                    }),
                ],
            ),
        ];
    }
}
