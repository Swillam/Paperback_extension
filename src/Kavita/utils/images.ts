/**
 * Whether a url is a Kavita image (cover, page) that carries the API key in its
 * query string, so it can be loaded without signing in.
 */
export function isImageRequest(url: string): boolean {
    const isImage = url.includes("/image/") || url.includes("/Reader/image");
    return isImage && /[?&]apiKey=[^&]+/.test(url);
}
