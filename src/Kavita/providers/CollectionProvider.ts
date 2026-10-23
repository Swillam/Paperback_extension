import {
    ContentRating,
    ManagedCollection,
    ManagedCollectionChangeset,
    SourceManga,
} from "@paperback/types";
import { getKavitaApiKey, getKavitaUrl } from "../settings";
import {
    collectionManagedId,
    CollectionRef,
    parseCollectionRef,
    WANT_TO_READ_ID,
} from "../utils/collections";
import { fetchJSON } from "../utils/CommonUtils";
import { seriesToSourceManga, toSeriesIds } from "../utils/manga";

const PAGE_SIZE = 100;
// Safety net against an endless loop if the server ignores the page number
const MAX_PAGES = 50;

/**
 * Exposes Kavita's "Want to Read" list and the user's collections as Paperback
 * library collections
 */
export class CollectionProvider {
    async getManagedLibraryCollections(): Promise<ManagedCollection[]> {
        const collections = await fetchJSON<Kavita.CollectionTag[]>({
            url: `${getKavitaUrl()}/Collection?ownedOnly=true`,
            method: "GET",
        });

        return [
            { id: WANT_TO_READ_ID, title: "Want to Read" },
            ...collections.map((collection) => ({
                id: collectionManagedId(collection.id),
                title: collection.title,
            })),
        ];
    }

    async getSourceMangaInManagedCollection(
        collection: ManagedCollection,
    ): Promise<SourceManga[]> {
        const ref = this.parse(collection);
        const kavitaUrl = getKavitaUrl();
        const apiKey = getKavitaApiKey();
        const mangas: SourceManga[] = [];

        for (let page = 1; page <= MAX_PAGES; page++) {
            const series = await this.fetchPage(ref, page);

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
        const ref = this.parse(changeset.collection);
        const additions = toSeriesIds(changeset.additions);
        const deletions = toSeriesIds(changeset.deletions);

        if (ref.kind === "want-to-read") {
            await this.post("/want-to-read/add-series", {
                seriesIds: additions,
            });
            await this.post("/want-to-read/remove-series", {
                seriesIds: deletions,
            });
            return;
        }

        if (additions.length > 0) {
            await this.post("/Collection/update-for-series", {
                collectionTagId: ref.id,
                collectionTagTitle: changeset.collection.title,
                seriesIds: additions,
            });
        }

        if (deletions.length > 0) {
            // Kavita wants the whole collection back to remove series from it
            const tag = await fetchJSON<Kavita.CollectionTag>({
                url: `${getKavitaUrl()}/Collection/single?collectionId=${ref.id}`,
                method: "GET",
            });
            await this.post("/Collection/update-series", {
                tag,
                seriesIdsToRemove: deletions,
            });
        }
    }

    private parse(collection: ManagedCollection): CollectionRef {
        const ref = parseCollectionRef(collection.id);
        if (!ref) {
            throw new Error(`Unknown Kavita collection: ${collection.id}`);
        }
        return ref;
    }

    private async fetchPage(
        ref: CollectionRef,
        page: number,
    ): Promise<Kavita.SerieResponse[]> {
        const kavitaUrl = getKavitaUrl();

        if (ref.kind === "collection") {
            return fetchJSON<Kavita.SerieResponse[]>({
                url: `${kavitaUrl}/Series/series-by-collection?collectionId=${ref.id}&PageNumber=${page}&PageSize=${PAGE_SIZE}`,
                method: "GET",
            });
        }

        return fetchJSON<Kavita.SerieResponse[]>({
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
    }

    private async post(path: string, body: object): Promise<void> {
        // Nothing to send: skip the request
        if (
            "seriesIds" in body &&
            Array.isArray(body.seriesIds) &&
            body.seriesIds.length === 0
        ) {
            return;
        }

        const [response] = await Application.scheduleRequest({
            url: `${getKavitaUrl()}${path}`,
            method: "POST",
            body: JSON.stringify(body),
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(
                `Kavita request ${path} failed (HTTP ${response.status})`,
            );
        }
    }
}
