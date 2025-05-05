import {
    Chapter,
    Form,
    FormItemElement,
    LabelRow,
    Section,
    SelectRow,
    SourceManga,
} from "@paperback/types";
import { getKavitaUrl } from "../settings";

/**
 * Form for viewing and managing manga reading progress
 * Allows changing reading status, rating, and viewing chapters
 */
export class MangaProgressForm extends Form {
    constructor(
        private sourceManga: SourceManga,
        private currentStatus: string = "not readed",
        private readChapterIds: Set<string> | null = null,
        private chapters: Chapter[],
    ) {
        super();

        this.sourceManga = sourceManga;
        this.chapters = chapters || [];
        this.readChapterIds = readChapterIds;

        this.currentStatus = currentStatus;
    }

    /**
     * Helper to determine if text will be too long for UI layout
     */
    private isTextTooLong(title: string, value: string): boolean {
        const getVisualLength = (text: string): number => {
            let length = 0;
            for (const char of text) {
                if (/[wmWM]/.test(char)) {
                    length += 1.5;
                } else if (/[iltfjrI!.,']/.test(char)) {
                    length += 0.5;
                } else {
                    length += 1;
                }
            }
            return length;
        };

        return getVisualLength(title) + getVisualLength(value) + 2 > 45;
    }

    getSections(): Application.FormSectionElement[] {
        const tagRows: FormItemElement<unknown>[] = [];
        if (this.sourceManga.mangaInfo.tagGroups?.length) {
            for (const tagGroup of this.sourceManga.mangaInfo.tagGroups) {
                if (tagGroup.tags.length) {
                    tagRows.push(
                        LabelRow(`tag_group_${tagGroup.id}`, {
                            title: tagGroup.title,
                            subtitle: tagGroup.tags
                                .map((tag) => tag.title)
                                .join(", "),
                        }),
                    );
                }
            }
        }

        const sections: Application.FormSectionElement[] = [
            Section("manga_info", [
                this.isTextTooLong(
                    "Title",
                    this.sourceManga.mangaInfo.primaryTitle,
                )
                    ? LabelRow("title", {
                          title: "Title",
                          subtitle: this.sourceManga.mangaInfo.primaryTitle,
                      })
                    : LabelRow("title", {
                          title: "Title",
                          value: this.sourceManga.mangaInfo.primaryTitle,
                      }),
                this.isTextTooLong(
                    "Author",
                    this.sourceManga.mangaInfo.author || "Unknown",
                )
                    ? LabelRow("author", {
                          title: "Author",
                          subtitle:
                              this.sourceManga.mangaInfo.author || "Unknown",
                      })
                    : LabelRow("author", {
                          title: "Author",
                          value: this.sourceManga.mangaInfo.author || "Unknown",
                      }),
                ...(this.sourceManga.mangaInfo.artist
                    ? [
                          LabelRow("artist", {
                              title: "Artist",
                              value: this.sourceManga.mangaInfo.artist,
                          }),
                      ]
                    : []),
                LabelRow("status", {
                    title: "Status",
                    value: this.sourceManga.mangaInfo.status || "Unknown",
                }),
                ...(this.sourceManga.mangaInfo.rating !== undefined
                    ? [
                          LabelRow("rating", {
                              title: "Rating",
                              value: `${(this.sourceManga.mangaInfo.rating * 100).toFixed(0)}%`,
                          }),
                      ]
                    : []),
                LabelRow("content_rating", {
                    title: "Content Rating",
                    value: this.sourceManga.mangaInfo.contentRating,
                }),
                ...tagRows,
            ]),
        ];

        if (this.sourceManga.mangaInfo.secondaryTitles?.length) {
            sections.push(
                Section("alternative_titles", [
                    LabelRow("alt_titles", {
                        title: "Alternative Titles",
                        subtitle:
                            this.sourceManga.mangaInfo.secondaryTitles.join(
                                "| ",
                            ),
                    }),
                ]),
            );
        }

        sections.push(
            Section("synopsis", [
                LabelRow("synopsis", {
                    title: "Synopsis",
                    subtitle:
                        this.sourceManga.mangaInfo.synopsis ||
                        "No synopsis available",
                }),
            ]),
        );

        sections.push(
            Section("reading_status", [
                LabelRow("current_status", {
                    title: "Current Status",
                    value: this.currentStatus,
                }),
                SelectRow("reading_status", {
                    title: "Change Status",
                    subtitle: `Currently: ${this.currentStatus}`,
                    value: [this.currentStatus],
                    options: [
                        { id: "reading", title: "Reading" },
                        { id: "not readed", title: "Not Read" },
                        { id: "readed", title: "Read" },
                    ],
                    minItemCount: 1,
                    maxItemCount: 1,
                    onValueChange: Application.Selector(
                        this as MangaProgressForm,
                        "handleStatusChange",
                    ),
                }),
            ]),
        );

        const totalChapters =
            (this.sourceManga.chapterCount ?? 0) > 0
                ? this.sourceManga.chapterCount
                : this.chapters.length;

        let unreadChapters = this.sourceManga.unreadChapterCount || 0;
        if (unreadChapters === 0 && this.readChapterIds) {
            unreadChapters = this.chapters.filter(
                (chapter) => !this.readChapterIds?.has(chapter.chapterId),
            ).length;
        }

        let newChapters = this.sourceManga.newChapterCount || 0;
        if (newChapters === 0 && this.readChapterIds) {
            newChapters = this.chapters.filter(
                (chapter) => !this.readChapterIds?.has(chapter.chapterId),
            ).length;
        }

        sections.push(
            Section("chapter_stats", [
                LabelRow("total_chapters", {
                    title: "Total Chapters",
                    value: `${totalChapters}`,
                }),
                LabelRow("unread_chapters", {
                    title: "Unread Chapters",
                    value: `${unreadChapters}`,
                }),
                LabelRow("new_chapters", {
                    title: "New Chapters",
                    value: `${newChapters}`,
                }),
            ]),
        );

        if (this.chapters && this.chapters.length > 0) {
            const chapterItems: FormItemElement<unknown>[] = [];

            chapterItems.push(
                LabelRow("chapter_list_header", {
                    title: "Chapter List",
                    subtitle: `${this.chapters.length} chapters available - Read chapters are marked with ✓`,
                }),
            );

            for (const chapter of this.chapters) {
                const isRead =
                    this.readChapterIds?.has(chapter.chapterId) || false;
                const readMark = isRead ? "✓ " : "";

                let chapterTitle = `${readMark}`;

                if (chapter.volume) {
                    chapterTitle += `Vol ${chapter.volume} `;
                }

                chapterTitle += `Ch ${chapter.chapNum}`;

                if (chapter.title) {
                    chapterTitle += `: ${chapter.title}`;
                }

                chapterItems.push(
                    LabelRow(`chapter_${chapter.chapterId}`, {
                        title: chapterTitle,
                        subtitle: `${chapter.version || ""}`,
                    }),
                );
            }

            sections.push(Section("chapter_list", chapterItems));
        } else if (this.chapters.length === 0) {
            sections.push(
                Section("chapter_list", [
                    LabelRow("no_chapters", {
                        title: "No chapters available",
                        subtitle: "No chapters were found for this manga",
                    }),
                ]),
            );
        }

        return sections;
    }

    /**
     * Handles updating the user's reading status for the manga
     */
    async handleStatusChange(value: string[]): Promise<void> {
        if (value.length === 0) return;

        const newStatus = value[0];
        if (newStatus === this.currentStatus) return;

        this.currentStatus = newStatus;
        this.reloadForm();
    }

    /**
     * Submits changes to reading status to Kavita
     */
    async formDidSubmit(): Promise<void> {
        try {
            switch (this.currentStatus) {
                case "not readed": {
                    const markUnreadRequest = {
                        url: `${getKavitaUrl()}/api/Reader/mark-unread`,
                        body: JSON.stringify({
                            seriesId: this.sourceManga.mangaId,
                        }),
                        method: "POST",
                    };
                    await Application.scheduleRequest(markUnreadRequest);
                    break;
                }

                case "readed": {
                    const markReadRequest = {
                        url: `${getKavitaUrl()}/api/Reader/mark-read`,
                        body: JSON.stringify({
                            seriesId: this.sourceManga.mangaId,
                        }),
                        method: "POST",
                    };
                    await Application.scheduleRequest(markReadRequest);
                    break;
                }

                case "reading": {
                    for (const chapter of this.chapters) {
                        if (this.readChapterIds?.has(chapter.chapterId)) {
                            const markReadRequest = {
                                url: `${getKavitaUrl()}/api/Reader/progress`,
                                body: {
                                    volumeId:
                                        chapter.volume ??
                                        this.sourceManga.mangaId,
                                    chapterId: chapter.chapterId,
                                    pageNum: chapter.additionalInfo?.pages || 0,
                                    seriesId: this.sourceManga.mangaId,
                                    libraryId:
                                        this.sourceManga.mangaInfo
                                            .additionalInfo?.libraryId ?? 0,
                                    lastModifiedUtc: new Date().toISOString(),
                                },
                                method: "POST",
                            };
                            await Application.scheduleRequest(markReadRequest);
                        }
                    }
                    break;
                }
                default:
                    throw new Error(`Invalid status: ${this.currentStatus}`);
            }
        } catch (error) {
            console.log(`Error updating manga progress: ${String(error)}`);
            throw new Error(
                `Failed to update manga progress: ${String(error)}`,
            );
        }
    }
}
