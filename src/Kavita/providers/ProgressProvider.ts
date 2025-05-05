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
            const pagesRead = chapter.additionalInfo?.pagesRead ?? "0";
            if (parseInt(pagesRead) === 0) {
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
                url: `${getKavitaUrl()}/api/Reader/continue-point?seriesId=${sourceManga.mangaId}`,
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
     * Processes chapter read status updates to MangaDex
     */
    async processChapterReadActionQueue(
        actions: TrackedMangaChapterReadAction[],
    ): Promise<ChapterReadActionQueueProcessingResult> {
        const successfulItems: string[] = [];
        const failedItems: string[] = [];

        for (const action of actions) {
            const chapterId = action.readChapter?.chapterId;
            const chapterPageNumber = action.readChapter?.chapNum;
            if (!chapterId) {
                console.warn(
                    `Skipping chapter read action due to invalid or missing chapterId ('${chapterId ?? "undefined"}') for manga: ${action.sourceManga.mangaId}`,
                );
                continue;
            }

            const mangaId = action.sourceManga.mangaId;
            const libraryId =
                action.sourceManga.mangaInfo.additionalInfo?.libraryId || 0;

            const kavitaURL = getKavitaUrl();
            const url = `${kavitaURL}/api/Reader/progress`;

            const request = {
                url,
                method: "POST",
                body: {
                    volumeId: mangaId,
                    chapterId: chapterId,
                    pageNum: chapterPageNumber,
                    seriesId: mangaId,
                    libraryId: libraryId,
                    bookScrollId: null,
                    lastModifiedUtc: new Date().toISOString(),
                },
            };

            try {
                await Application.scheduleRequest(request);
                successfulItems.push(mangaId);
            } catch (error) {
                console.log(
                    `Error updating read status for ${mangaId}: ${String(error)}`,
                );
                failedItems.push(mangaId);
            }
        }

        return {
            successfulItems,
            failedItems,
        };
    }
}
