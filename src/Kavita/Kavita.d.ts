declare namespace Kavita {
    type ChapterResponse = Volume[];
    type AllLibraries = LibraryResponse[];

    interface Volume {
        id: number;
        minNumber: number;
        maxNumber: number;
        name: string;
        pages: number;
        pagesRead: number;
        lastModifiedUtc: string;
        createdUtc: string;
        created: string;
        lastModified: string;
        seriesId: number;
        chapters: Chapter[];
        minHoursToRead: number;
        maxHoursToRead: number;
        avgHoursToRead: number;
        wordCount: number;
        coverImage: string;
        primaryColor: string;
        secondaryColor: string;
    }

    interface Chapter {
        id: number;
        range: string;
        number: string;
        minNumber: number;
        maxNumber: number;
        sortOrder: number;
        pages: number;
        isSpecial: boolean;
        title: string;
        files: ChapterFile[];
        pagesRead: number;
        lastReadingProgressUtc: string;
        lastReadingProgress: string;
        coverImageLocked: boolean;
        volumeId: number;
        createdUtc: string;
        lastModifiedUtc: string;
        created: string;
        releaseDate: string;
        titleName: string;
        summary: string | null;
        ageRating: number;
        wordCount: number;
        volumeTitle: string;
        minHoursToRead: number;
        maxHoursToRead: number;
        avgHoursToRead: number;
        webLinks: string;
        isbn: string;
        writers: string[];
        coverArtists: string[];
        publishers: string[];
        characters: string[];
        pencillers: string[];
        inkers: string[];
        imprints: string[];
        colorists: string[];
        letterers: string[];
        editors: string[];
        translators: string[];
        teams: string[];
        locations: string[];
        genres: string[];
        tags: string[];
        publicationStatus: number;
        language: string | null;
        count: number;
        totalCount: number;
        languageLocked: boolean;
        summaryLocked: boolean;
        ageRatingLocked: boolean;
        publicationStatusLocked: boolean;
        genresLocked: boolean;
        tagsLocked: boolean;
        writerLocked: boolean;
        characterLocked: boolean;
        coloristLocked: boolean;
        editorLocked: boolean;
        inkerLocked: boolean;
        imprintLocked: boolean;
        lettererLocked: boolean;
        pencillerLocked: boolean;
        publisherLocked: boolean;
        translatorLocked: boolean;
        teamLocked: boolean;
        locationLocked: boolean;
        coverArtistLocked: boolean;
        releaseYearLocked: boolean;
        coverImage: string;
        primaryColor: string;
        secondaryColor: string;
    }
    
    interface ChapterFile {
        id: number;
        filePath: string;
        pages: number;
        bytes: number;
        format: number;
        created: string;
        extension: string;
    }    

    interface Contributor {
        id: number;
        name: string;
        coverImageLocked: boolean;
        primaryColor: string;
        secondaryColor: string;
        coverImage: string;
        description: string;
        asin: string;
        aniListId: number;
        malId: number;
        hardcoverId: string;
    }

    interface Genre {
        id: number;
        title: string;
    }

    interface SerieResponse {
        id: number;
        name: string;
        originalName: string;
        localizedName: string;
        sortName: string;
        pages: number;
        coverImageLocked: boolean;
        pagesRead: number;
        latestReadDate: string;
        lastChapterAdded: string;
        userRating: number;
        hasUserRated: boolean;
        format: number;
        created: string;
        nameLocked: boolean;
        sortNameLocked: boolean;
        localizedNameLocked: boolean;
        wordCount: number;
        libraryId: number;
        libraryName: string;
        minHoursToRead: number;
        maxHoursToRead: number;
        avgHoursToRead: number;
        folderPath: string;
        lowestFolderPath: string;
        lastFolderScanned: string;
        dontMatch: boolean;
        isBlacklisted: boolean;
        coverImage: string;
        primaryColor: string;
        secondaryColor: string;
    }

    interface SerieMetadata {
        id: number;
        summary: string;
        genres: { id: number; title: string }[];
        tags: { id: number; title: string }[];
        writers: Contributor[];
        coverArtists: Contributor[];
        publishers: Contributor[];
        characters: Contributor[];
        pencillers: Contributor[];
        inkers: Contributor[];
        imprints: Contributor[];
        colorists: Contributor[];
        letterers: Contributor[];
        editors: Contributor[];
        translators: Contributor[];
        teams: Contributor[];
        locations: Contributor[];
        ageRating: number;
        releaseYear: number;
        language: string;
        maxCount: number;
        totalCount: number;
        publicationStatus: number;
        webLinks: string;
        languageLocked: boolean;
        summaryLocked: boolean;
        ageRatingLocked: boolean;
        publicationStatusLocked: boolean;
        genresLocked: boolean;
        tagsLocked: boolean;
        writerLocked: boolean;
        characterLocked: boolean;
        coloristLocked: boolean;
        editorLocked: boolean;
        inkerLocked: boolean;
        imprintLocked: boolean;
        lettererLocked: boolean;
        pencillerLocked: boolean;
        publisherLocked: boolean;
        translatorLocked: boolean;
        teamLocked: boolean;
        locationLocked: boolean;
        coverArtistLocked: boolean;
        releaseYearLocked: boolean;
        seriesId: number;
    }

    interface LibraryResponse {
        id: number;
        name: string;
        lastScanned: string; // ISO date string
        type: number;
        coverImage: string;
        folderWatching: boolean;
        includeInDashboard: boolean;
        includeInRecommended: boolean;
        manageCollections: boolean;
        manageReadingLists: boolean;
        includeInSearch: boolean;
        allowScrobbling: boolean;
        folders: string[];
        collapseSeriesRelationships: boolean;
        libraryFileTypes: number[];
        excludePatterns: string[];
        allowMetadataMatching: boolean;
    }

    interface Metadata {
        offset?: number;
        collectedIds?: string[];
    }
}
