/**
 * Describes the outcome of an authentication attempt with the given settings,
 * as a message that can be shown to the user.
 */
export async function checkConnection(
    kavitaUrl: string,
    apiKey: string,
): Promise<string> {
    if (kavitaUrl === "") return "Server URL is empty.";
    if (apiKey.trim() === "") return "API key is empty.";

    try {
        const [response, buffer] = await Application.scheduleRequest({
            url: `${kavitaUrl}/Plugin/authenticate?apiKey=${encodeURIComponent(apiKey.trim())}&pluginName=Kavita`,
            method: "POST",
        });

        if (response.status === 401 || response.status === 400) {
            return "The server rejected the API key.";
        }
        if (response.status < 200 || response.status >= 300) {
            return `The server answered with HTTP ${response.status}. Check the URL.`;
        }

        let data: { username?: string; kavitaVersion?: string; token?: string };
        try {
            data = JSON.parse(
                Application.arrayBufferToUTF8String(buffer),
            ) as typeof data;
        } catch {
            return "The server did not answer like Kavita. Check the URL.";
        }
        if (!data.token) return "The server did not return a token.";

        const version = data.kavitaVersion
            ? ` (Kavita ${data.kavitaVersion})`
            : "";
        return `Connected as ${data.username ?? "unknown user"}${version}.`;
    } catch (error) {
        return `Cannot reach the server: ${String(error)}`;
    }
}
