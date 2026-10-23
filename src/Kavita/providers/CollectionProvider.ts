import {
    ContentRating,
    ManagedCollection,
    ManagedCollectionChangeset,
    SourceManga,
} from "@paperback/types";
import { getKavitaApiKey, getKavitaUrl } from "../settings";
import { fetchJSON } from "../utils/CommonUtils";
import { seriesToSourceManga, toSeriesIds } from "../utils/manga";

const WANT_TO_READ = "want-to-read";
const PAGE_SIZE = 100;
// Safety net against an endless loop if the server ignores the page number
const MAX_PAGES = 50;

/**
 * Exposes Kavita's "Want to Read" list as a Paperback library collection
 */
export class CollectionProvider {
    async getManagedLibraryCollections(): Promise<ManagedCollection[]> {
        return [{ id: WANT_TO_READ, title: "Want to Read" }];
    }

    async getSourceMangaInManagedCollection(
        collection: ManagedCollection,
    ): Promise<SourceManga[]> {
        this.assertSupported(collection);

        const kavitaUrl = getKavitaUrl();
        const apiKey = getKavitaApiKey();
        const mangas: SourceManga[] = [];

        for (let page = 1; page <= MAX_PAGES; page++) {
            const series = await fetchJSON<Kavita.SerieResponse[]>({
                url: `${kavitaUrl}/want-to-read/v2?PageNumber=${page}&PageSize=${PAGE_SIZE}`,
                method: "POST",
                body: JSON.stringify({
                    id: 0,
                    name: "want-to-read",
                    statements: [],
                    combination: 1,
                    sortOptions: { sortField: 1, isAscending: true },
                    limitTo: 0,
                }),
            });

            for (const item of series) {
                mangas.push(
                    seriesToSourceManga(
                        item,
                        `${kavitaUrl}/image/series-cover?seriesId=${item.id}&apiKey=${apiKey}`,
                        ContentRating.EVERYONE,
                    ),
                );
            }

            if (series.length < PAGE_SIZE) break;
        }

        return mangas;
    }

    async commitManagedCollectionChanges(
        changeset: ManagedCollectionChangeset,
    ): Promise<void> {
        this.assertSupported(changeset.collection);

        await this.updateWantToRead(
            "add-series",
            toSeriesIds(changeset.additions),
        );
        await this.updateWantToRead(
            "remove-series",
            toSeriesIds(changeset.deletions),
        );
    }

    private assertSupported(collection: ManagedCollection): void {
        if (collection.id !== WANT_TO_READ) {
            throw new Error(`Unknown Kavita collection: ${collection.id}`);
        }
    }

    private async updateWantToRead(
        action: "add-series" | "remove-series",
        seriesIds: number[],
    ): Promise<void> {
        if (seriesIds.length === 0) return;

        const [response] = await Application.scheduleRequest({
            url: `${getKavitaUrl()}/want-to-read/${action}`,
            method: "POST",
            body: JSON.stringify({ seriesIds }),
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(
                `Kavita Want to Read ${action} failed (HTTP ${response.status})`,
            );
        }
    }
}
