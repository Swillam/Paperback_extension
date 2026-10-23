import { ContentRating } from "@paperback/types";

/**
 * Content rating of the series shown in lists (Discover, search).
 *
 * Paperback does not show the covers of the carousels whose items have no
 * content rating (a placeholder with a "U" is shown instead; only the featured
 * carousel was spared): every item must carry one. Kavita's lists do not give
 * the age rating of a series (it is only in the metadata of each series), so
 * they are all treated as everyone, as the series page already is.
 */
export const LIST_CONTENT_RATING = ContentRating.EVERYONE;
