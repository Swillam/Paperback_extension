import { SourceManga, URL, ContentRating, Tag, TagSection } from "@paperback/types";
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
            method: 'GET',
        };
        const metadataRequest = {
            url: `${kavitaURL}/Series/metadata`,
            param: `?seriesId=${mangaId}`,
            method: 'GET',
        };    
    
        const seriesResult = await fetchJSON<Kavita.SerieResponse>(seriesRequest);
        const metadataResult = await fetchJSON<any>(metadataRequest);
    
        // exclude people tags for now
        const tagNames = ['genres', 'tags']
        const tagSections: TagSection[] = [];
    
        for (const tagName of tagNames) {
            const tags: Tag[] = [];
    
            for (const tag of metadataResult[tagName]) {
                tags.push({
                    id: `${tagName}-${tag.id}`,
                    title: tag.title
                });
            }
    
            tagSections.push({
                id: tagName,
                title: tagName,
                tags: tags
            });
        }
    
        let artists = [];
        for (const penciller of metadataResult.pencillers) {
            artists.push(penciller.name);
        }
    
        let authors = [];
        for (const writer of metadataResult.writers) {
            authors.push(writer.name);
        }
        
        return {
            mangaId: mangaId,
            mangaInfo: {
                primaryTitle: seriesResult.name,
                secondaryTitles: [seriesResult.originalName, seriesResult.localizedName, seriesResult.sortName],
                thumbnailUrl: `${kavitaURL}/image/series-cover?seriesId=${mangaId}&apiKey=${kavitaAPI}`,
                author: authors.join(', '),
                artist: artists.join(', '),
                synopsis: metadataResult.summary.replace(/<[^>]+>/g, ''),
                status: KAVITA_PUBLICATION_STATUS[metadataResult.publicationStatus] ?? 'Unknown',
                tagGroups: tagSections,
                contentRating: ContentRating.EVERYONE,
                shareUrl: `${kavitaURL}/title/${mangaId}`,
                rating: seriesResult.userRating,
                artworkUrls: /*artworkUrls.length > 0 ? artworkUrls :*/ undefined,
            },
        };
    }
}

