/**
 * Whether a url is a Kavita image (cover, page) that carries the API key in its
 * query string, so it can be loaded without signing in.
 */
export function isImageRequest(url: string): boolean {
    const isImage = url.includes("/image/") || url.includes("/Reader/image");
    return isImage && /[?&]apiKey=[^&]+/.test(url);
}

/**
 * Address of a series cover. A last query parameter ending with an image
 * extension is added, which Kavita ignores (it answers the identical image):
 * in a diagnostic on a phone, the covers whose address had no extension were
 * never requested by the app while the ones with an extension were. The missing
 * content rating of the Discover items (see utils/rating.ts) was the cause of
 * the empty covers; this precaution costs nothing.
 */
export function coverUrl(
    baseUrl: string,
    seriesId: number | string,
    apiKey: string,
): string {
    return `${baseUrl}/image/series-cover?seriesId=${seriesId}&apiKey=${apiKey}&ext=.png`;
}
