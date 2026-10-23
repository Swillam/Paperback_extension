import {
    Chapter,
    ChapterDetails,
    SourceManga,
    UpdateManager,
    URL,
} from "@paperback/types";
import { getKavitaApiKey, getKavitaUrl } from "../settings";
import {
    chapterDate,
    chapterName,
    stripFileExtension,
} from "../utils/chapters";
import { fetchJSON } from "../utils/CommonUtils";
import { TtlCache } from "../utils/TtlCache";
import { chunk, shouldRefreshChapters } from "../utils/updates";

// Series checked per request when looking for new chapters
const UPDATE_CHECK_BATCH_SIZE = 100;

const CHAPTER_CACHE_TTL_MS = 10_000;

/**
 * Handles fetching and processing of manga chapters
 */
export class ChapterProvider {
    // The app asks for the chapters of a series several times in a row
    // (chapter list, progress, progress form): avoid hitting the server each time
    private chapterCache = new TtlCache<Chapter[]>(CHAPTER_CACHE_TTL_MS);

    /**
     * Forgets the cached chapters of a series, to call after changing its progress
     */
    invalidateChapters(mangaId: string): void {
        this.chapterCache.delete(mangaId);
    }

    /**
     * Fetches chapters for a manga, optionally updating metadata
     */
    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const cached = this.chapterCache.get(sourceManga.mangaId);
        if (cached) return [...cached];

        const chapters = await this.fetchChapters(sourceManga);
        this.chapterCache.set(sourceManga.mangaId, chapters);
        return [...chapters];
    }

    private async fetchChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const kavitaUrl = getKavitaUrl();
        const mangaId = sourceManga.mangaId;

        const request = {
            url: new URL(kavitaUrl)
                .addPathComponent("Series")
                .addPathComponent("volumes")
                .setQueryItem("seriesId", mangaId)
                .toString(),
            method: "GET",
        };

        const result = await fetchJSON<Kavita.ChapterResponse>(request);

        const chapters: Chapter[] = [],
            specials: Chapter[] = [];

        let i = 0;
        let j = 1;
        for (const volume of result) {
            for (const chapter of volume.chapters) {
                const name = chapterName(chapter);
                const title = stripFileExtension(chapter.range);
                const time = chapterDate(chapter.releaseDate, chapter.created);

                const item: Chapter = {
                    chapterId: `${chapter.id}`,
                    sourceManga,
                    title: chapter.isSpecial ? title : name,
                    chapNum:
                        chapter.number === "-100000"
                            ? 1
                            : chapter.isSpecial
                              ? j++
                              : parseFloat(chapter.number), // chapter.number is 0 when it's a special
                    volume: chapter.isSpecial
                        ? 0
                        : volume.name === "-100000"
                          ? 0
                          : parseFloat(volume.name), // assign both special and chapters w/o volumes w/ volume 0 as it's hidden by paperback,
                    langCode: chapter.language ?? "en",
                    version: `${chapter.isSpecial ? "Specials · " : ""}`,
                    publishDate: time,
                    sortingIndex: i,
                    additionalInfo: {
                        pages: `${chapter.pages}`,
                        pagesRead: `${chapter.pagesRead}`,
                        volumeId: `${volume.id}`,
                    },
                };

                i++;

                if (chapter.isSpecial) specials.push(item);
                else chapters.push(item);
            }
        }

        return chapters.concat(specials);
    }

    /**
     * Gets page details for a specific chapter
     */
    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const chapterId = chapter.chapterId;
        const mangaId = chapter.sourceManga.mangaId;
        const kavitaURL = getKavitaUrl();
        const kavitaAPI = getKavitaApiKey();

        const request = {
            url: `${kavitaURL}/Series/chapter?chapterId=${chapterId}`,
            method: "GET",
        };

        const result = await fetchJSON<Kavita.Chapter>(request);

        const pages: string[] = [];
        for (let i = 0; i < result.pages; i++) {
            pages.push(
                `FAKE*/${i}?*REAL*${kavitaURL}/Reader/image?chapterId=${chapterId}&page=${i}&apiKey=${kavitaAPI}&extractPdf=true`,
            );
        }

        const chapterDetails: ChapterDetails = {
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
        };
        return chapterDetails;
    }

    /**
     * Processes titles for updates
     */
    async processTitlesForUpdates(updateManager: UpdateManager): Promise<void> {
        const sourceManga = updateManager.getQueuedItems();
        const mangaMap = new Map(sourceManga.map((m) => [m.mangaId, m]));
        const skipUpdate: string[] = [];

        // One request per batch of series instead of one per series
        for (const batch of chunk(
            [...mangaMap.keys()],
            UPDATE_CHECK_BATCH_SIZE,
        )) {
            const seriesIds = batch
                .map((id) => parseInt(id))
                .filter((id) => Number.isFinite(id));

            let series: Kavita.SerieResponse[];
            try {
                series = await fetchJSON<Kavita.SerieResponse[]>({
                    url: `${getKavitaUrl()}/Series/series-by-ids`,
                    method: "POST",
                    body: JSON.stringify({ seriesIds }),
                });
            } catch (error) {
                // Let Paperback's default flow check these series
                console.log(
                    `Update check failed for a batch: ${String(error)}`,
                );
                continue;
            }

            // Kavita leaves out the series that do not exist or are not accessible
            const apiMarkers = new Map(
                series.map((s) => [`${s.id}`, s.lastChapterAddedUtc]),
            );

            for (const mangaId of batch) {
                const manga = mangaMap.get(mangaId);
                const refresh = shouldRefreshChapters({
                    storedMarker:
                        manga?.mangaInfo?.additionalInfo?.latestUploadedChapter,
                    apiMarker: apiMarkers.get(mangaId),
                    unreadChapterCount: manga?.unreadChapterCount,
                    chapterCount: manga?.chapterCount,
                });
                if (!refresh) skipUpdate.push(mangaId);
            }
        }

        for (const mangaId of skipUpdate) {
            await updateManager.setNewChapters(mangaId, []);
        }
    }
}
