import {
    Chapter,
    ChapterReadActionQueueProcessingResult,
    Form,
    MangaProgress,
    SourceManga,
    TrackedMangaChapterReadAction,
} from "@paperback/types";
import { MangaProgressForm } from "../forms/MangaProgressForm";
import { getKavitaUrl } from "../settings";
import { fetchJSON } from "../utils/CommonUtils";
import { toInt } from "../utils/numbers";
import { ChapterProvider } from "./ChapterProvider";

/**
 * Manages reading progress and chapter tracking
 */
export class ProgressProvider {
    private chapterProvider: ChapterProvider;

    constructor(chapterProvider: ChapterProvider) {
        this.chapterProvider = chapterProvider;
    }

    /**
     * Returns the form for managing manga reading progress
     */
    async getMangaProgressManagementForm(
        sourceManga: SourceManga,
    ): Promise<Form> {
        const kavitaUrl = getKavitaUrl();

        const requestReadingStatus = {
            url: `${kavitaUrl}/Reader/has-progress?seriesId=${sourceManga.mangaId}`,
            method: "GET",
        };
        const chapters: Chapter[] =
            await this.chapterProvider.getChapters(sourceManga);

        const resultReadingStatus =
            await fetchJSON<boolean>(requestReadingStatus);

        if (!resultReadingStatus) {
            return new MangaProgressForm(
                sourceManga,
                "not readed",
                null,
                chapters,
            );
        }

        let readingStatus = "reading";
        const readChapterIds: Set<string> = new Set();

        for (const chapter of chapters) {
            const pages = parseInt(chapter.additionalInfo?.pages ?? "0");
            const pagesRead = parseInt(
                chapter.additionalInfo?.pagesRead ?? "0",
            );
            if (pages > 0 && pagesRead >= pages) {
                readChapterIds.add(chapter.chapterId);
            }
        }

        if (readChapterIds.size === 0) {
            readingStatus = "not readed";
        } else if (readChapterIds.size === chapters.length) {
            readingStatus = "readed";
        }

        return new MangaProgressForm(
            sourceManga,
            readingStatus,
            readChapterIds,
            chapters,
        );
    }

    /**
     * Gets the current reading progress for a manga
     */
    async getMangaProgress(
        sourceManga: SourceManga,
    ): Promise<MangaProgress | undefined> {
        try {
            const result = await fetchJSON<Kavita.Chapter>({
                url: `${getKavitaUrl()}/Reader/continue-point?seriesId=${sourceManga.mangaId}`,
                method: "GET",
            });

            const chapters: Chapter[] =
                await this.chapterProvider.getChapters(sourceManga);

            const chapter = chapters.find(
                (chapter) => chapter.chapterId === `${result.id}`,
            );

            if (!chapter) {
                console.warn(
                    `Chapter not found for manga: ${sourceManga.mangaId}`,
                );
                return undefined;
            }

            return {
                sourceManga: sourceManga,
                lastReadChapter: chapter,
            };
        } catch (error) {
            console.log(`Error fetching manga progress: ${String(error)}`);
            return undefined;
        }
    }

    /**
     * Processes chapter read status updates to Kavita
     */
    async processChapterReadActionQueue(
        actions: TrackedMangaChapterReadAction[],
    ): Promise<ChapterReadActionQueueProcessingResult> {
        const successfulItems: string[] = [];
        const failedItems: string[] = [];

        for (const action of actions) {
            const chapterId = action.readChapter?.chapterId;
            if (!chapterId) {
                console.warn(
                    `Skipping chapter read action due to invalid or missing chapterId ('${chapterId ?? "undefined"}') for manga: ${action.sourceManga.mangaId}`,
                );
                failedItems.push(action.id);
                continue;
            }
            const info = action.readChapter?.additionalInfo;
            const volumeId = info?.volumeId ?? action.sourceManga.mangaId;
            const pageNum = parseInt(info?.pages ?? "0");

            const mangaId = action.sourceManga.mangaId;
            const libraryId = toInt(
                action.sourceManga.mangaInfo.additionalInfo?.libraryId,
            );

            const kavitaURL = getKavitaUrl();
            const url = `${kavitaURL}/Reader/progress`;

            const request = {
                url,
                method: "POST",
                body: {
                    volumeId: parseInt(volumeId),
                    chapterId: parseInt(chapterId),
                    pageNum: pageNum,
                    seriesId: parseInt(mangaId),
                    libraryId: libraryId,
                    bookScrollId: null,
                    lastModifiedUtc: new Date().toISOString(),
                },
            };

            try {
                const [response] = await Application.scheduleRequest(request);
                if (response.status >= 400) {
                    throw new Error(`HTTP ${response.status}`);
                }
                successfulItems.push(action.id);
            } catch (error) {
                console.log(
                    `Error updating read status for ${mangaId}: ${String(error)}`,
                );
                failedItems.push(action.id);
            }
        }

        return {
            successfulItems,
            failedItems,
        };
    }
}
