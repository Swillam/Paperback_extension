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

/**
 * Handles fetching and processing of manga chapters
 */
export class ChapterProvider {
    /**
     * Fetches chapters for a manga, optionally updating metadata
     */
    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
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

        const mangaMap = new Map<string, SourceManga>();
        const mangaIds: string[] = [];
        const skipUpdate: string[] = [];

        for (const manga of sourceManga) {
            mangaIds.push(manga.mangaId);
            mangaMap.set(manga.mangaId, manga);
        }

        for (const manga of sourceManga) {
            const request = {
                url: new URL(getKavitaUrl())
                    .addPathComponent("Series")
                    .addPathComponent("volumes")
                    .setQueryItem("seriesId", manga.mangaId)
                    .toString(),
                method: "GET",
            };
            const result = await fetchJSON<Kavita.ChapterResponse>(request);
            if (result) {
                const latestApiChapter = result[0].lastModifiedUtc;
                const latestStoredChapter =
                    manga.mangaInfo?.additionalInfo?.latestUploadedChapter;

                let skipUnread = false;
                if (
                    manga.unreadChapterCount !== undefined &&
                    manga.chapterCount
                ) {
                    skipUnread = manga.unreadChapterCount > 0;
                }

                if (
                    latestApiChapter &&
                    latestApiChapter !== latestStoredChapter &&
                    !skipUnread
                ) {
                    continue;
                } else {
                    skipUpdate.push(manga.mangaId);
                }
            }
        }

        for (const mangaId of skipUpdate) {
            await updateManager.setNewChapters(mangaId, []);
        }
    }
}
