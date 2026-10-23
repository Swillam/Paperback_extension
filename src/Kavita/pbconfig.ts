import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
    name: "Kavita",
    description: "Kavita client extension for Paperback",
    version: "1.0.0-alpha.16",
    icon: "icon.png",
    language: "multi",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.SETTINGS_UI,
        SourceIntents.DISCOVER_SECIONS,
        SourceIntents.MANGA_SEARCH,
        SourceIntents.MANGA_CHAPTERS,
        SourceIntents.MANGA_PROGRESS,
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
} satisfies SourceInfo;
