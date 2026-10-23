import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
    name: "Kavita",
    description: "Kavita client extension for Paperback",
    version: "1.0.2",
    icon: "icon.png",
    language: "multi",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.SETTINGS_FORM_PROVIDING,
        SourceIntents.DISCOVER_SECTION_PROVIDING,
        SourceIntents.SEARCH_RESULT_PROVIDING,
        SourceIntents.CHAPTER_PROVIDING,
        SourceIntents.PROGRESS_PROVIDING,
        SourceIntents.MANAGED_COLLECTION_PROVIDING,
    ],
    badges: [],
    developers: [
        {
            name: "Swillam",
            website: "",
            github: "https://github.com/Swillam",
        },
    ],
} satisfies ExtensionInfo;
