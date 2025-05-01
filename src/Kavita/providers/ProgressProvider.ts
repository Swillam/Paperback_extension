import {
    Chapter,
    ChapterReadActionQueueProcessingResult,
    Form,
    MangaProgress,
    SourceManga,
    TrackedMangaChapterReadAction,
    URL,
} from "@paperback/types";

import { ChapterProvider } from "./ChapterProvider";
import { getKavitaUrl } from "../settings";
import { fetchJSON } from "../utils/CommonUtils";

/**
 * Manages reading progress and chapter tracking
 */
export class ProgressProvider {
    private chapterProvider: ChapterProvider;

    constructor(chapterProvider: ChapterProvider) {
        this.chapterProvider = chapterProvider;
    }

    /**
     * Gets the current reading progress for a manga
     */
    async getMangaProgress(
        sourceManga: SourceManga,
    ): Promise<MangaProgress | undefined> {

        try {
            const kavita_url = getKavitaUrl();
            const url = new URL(kavita_url)
                .addPathComponent("manga")
                .addPathComponent(sourceManga.mangaId)
                .addPathComponent("read")
                .toString();

            const readStatus = await fetchJSON<any>({
                url,
                method: "GET",
            });

            if (readStatus.result !== "ok" || !readStatus.data) {
                console.log("Failed to get manga read status");
                return undefined;
            }

            const chapters =
                await this.chapterProvider.getChapters(sourceManga);

            if (chapters.length === 0) {
                return undefined;
            }

            let lastReadIndex = chapters.length - 1;

            if (readStatus.data && readStatus.data.length > 0) {
                const readChapterIds = new Set(readStatus.data);

                const readIndices = chapters
                    .map((chapter, index) => ({ id: chapter.chapterId, index }))
                    .filter((item) => readChapterIds.has(item.id))
                    .map((item) => item.index);

                if (readIndices.length > 0) {
                    lastReadIndex = Math.min(...readIndices) - 1;
                    lastReadIndex = Math.max(0, lastReadIndex);
                }
            }

            return {
                sourceManga: sourceManga,
                lastReadChapter: chapters[lastReadIndex],
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

        const chaptersByManga: Record<
            string,
            {
                mangaId: string;
                sourceManga: SourceManga;
                chapterIds: string[];
            }
        > = {};

        for (const action of actions) {
            const chapterId = action.readChapter?.chapterId;
            if (!chapterId) {
                console.warn(
                    `Skipping chapter read action due to invalid or missing chapterId ('${chapterId ?? "undefined"}') for manga: ${action.sourceManga.mangaId}`,
                );
                continue;
            }

            const mangaId = action.sourceManga.mangaId;

            if (!chaptersByManga[mangaId]) {
                chaptersByManga[mangaId] = {
                    mangaId,
                    sourceManga: action.sourceManga,
                    chapterIds: [],
                };
            }

            chaptersByManga[mangaId].chapterIds.push(chapterId);
        }

        for (const mangaGroup of Object.values(chaptersByManga)) {
            try {
                failedItems.push(...mangaGroup.chapterIds);
            } catch {
                failedItems.push(...mangaGroup.chapterIds);
            }
        }

        for (const mangaGroup of Object.values(chaptersByManga)) {
            try {
                const kavita_url = getKavitaUrl();
                const statusUrl = new URL(kavita_url)
                    .addPathComponent("manga")
                    .addPathComponent(mangaGroup.mangaId)
                    .addPathComponent("status")
                    .toString();

                const statusResponse =
                    await fetchJSON<any>({
                        url: statusUrl,
                        method: "GET",
                    });

                if (statusResponse.result !== "ok") {
                    continue;
                }

                const sourceManga = mangaGroup.sourceManga;
                let unreadCount = sourceManga.unreadChapterCount || 0;

                const chaptersToConsider = mangaGroup.chapterIds.length;
                unreadCount = Math.max(0, unreadCount - chaptersToConsider);

                let newStatus: string | null = null;

                if (!statusResponse.status) {
                    newStatus = unreadCount === 0 ? "completed" : "reading";
                } else if (
                    statusResponse.status === "reading" &&
                    unreadCount === 0
                ) {
                    newStatus = "completed";
                }

                if (newStatus) {
                    await fetchJSON<any>({
                        url: statusUrl,
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: { status: newStatus },
                    });
                }
            } catch (error) {
                console.log(`Error updating manga status: ${String(error)}`);
            }
        }

        return {
            successfulItems,
            failedItems,
        };
    }
}