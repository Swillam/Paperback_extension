import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
    name: "Kavita",
    description: "Kavita client extension for Paperback",
    version: "1.0.0-alpha.5",
    icon: "icon.png",
    language: "en",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.SETTINGS_UI,
        SourceIntents.DISCOVER_SECIONS,
        SourceIntents.MANGA_SEARCH,
        SourceIntents.MANGA_CHAPTERS,
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
