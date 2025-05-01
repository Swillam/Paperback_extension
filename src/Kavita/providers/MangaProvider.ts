import { ContentRating, SourceManga, Tag, TagSection } from "@paperback/types";
import { getKavitaApiKey, getKavitaUrl } from "../settings";
import { fetchJSON, KAVITA_PUBLICATION_STATUS } from "../utils/CommonUtils";

/**
 * Handles fetching manga details and information
 */
export class MangaProvider {
    /**
     * Retrieves detailed information for a specific manga
     */
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const kavitaAPI = getKavitaApiKey();
        const kavitaURL = getKavitaUrl();

        const seriesRequest = {
            url: `${kavitaURL}/Series/${mangaId}`,
            method: "GET",
        };
        const metadataRequest = {
            url: `${kavitaURL}/Series/metadata?seriesId=${mangaId}`,
            method: "GET",
        };

        const seriesResult =
            await fetchJSON<Kavita.SerieResponse>(seriesRequest);
        const metadataResult =
            await fetchJSON<Kavita.SerieMetadataResponse>(metadataRequest);
        const seriesMetadata =
            metadataResult.seriesMetadata as Kavita.SerieMetadata;

        const tagSections: TagSection[] = [];

        tagSections.push({
            id: "genres",
            title: "genres",
            tags: seriesMetadata.genres as Tag[],
        });

        tagSections.push({
            id: "tags",
            title: "tags",
            tags: seriesMetadata.tags as Tag[],
        });

        const artists = [];
        for (const penciller of seriesMetadata.pencillers) {
            artists.push(penciller.name);
        }

        const authors = [];
        for (const writer of seriesMetadata.writers) {
            authors.push(writer.name);
        }

        return {
            mangaId: mangaId,
            mangaInfo: {
                primaryTitle: seriesResult.name,
                secondaryTitles: [
                    seriesResult.originalName,
                    seriesResult.localizedName,
                    seriesResult.sortName,
                ],
                thumbnailUrl: `${kavitaURL}/image/series-cover?seriesId=${mangaId}&apiKey=${kavitaAPI}`,
                author: authors.join(", "),
                artist: artists.join(", "),
                synopsis: seriesMetadata.summary.replace(/<[^>]+>/g, ""),
                status:
                    KAVITA_PUBLICATION_STATUS[
                        seriesMetadata.publicationStatus
                    ] ?? "Unknown",
                tagGroups: tagSections,
                contentRating: ContentRating.EVERYONE,
                shareUrl: `${kavitaURL}/title/${mangaId}`,
                rating: seriesResult.userRating,
                artworkUrls:
                    /*artworkUrls.length > 0 ? artworkUrls :*/ undefined,
            },
        };
    }
}
