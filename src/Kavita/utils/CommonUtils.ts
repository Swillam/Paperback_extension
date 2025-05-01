import { Request } from "@paperback/types";

// common constants
export const KAVITA_PUBLICATION_STATUS: any = {
	0: 'Ongoing',
	1: 'Hiatus',
	2: 'Completed',
	3: 'Cancelled',
	4: 'Ended',
}

export const KAVITA_PERSON_ROLES: any = {
	'1': 'other',
	'2': 'artist',
	'3': 'writers', // KavitaAPI /api/series/all uses 'writers' instead of 'writer'
	'4': 'penciller',
	'5': 'inker',
	'6': 'colorist',
	'7': 'letterer',
	'8': 'coverArtist',
	'9': 'editor',
	'10': 'publisher',
	'11': 'character',
	'12': 'translators' // KavitaAPI /api/series/all uses 'translators' instead of 'translator'
}

//
// Kavya Setting State Methods
//
export const DEFAULT_VALUES: any = {
	kavitaAddress: 'https://demo.kavitareader.com',
	kavitaAPIUrl: 'https://demo.kavitareader.com/api',
	kavitaAPIKey: '',
	pageSize: 40,

	showOnDeck: true,
	showRecentlyUpdated: true,
	showNewlyAdded: true,
	excludeUnsupportedLibrary: false,
	
	enableRecursiveSearch: false
}

/**
 * Validates manga ID format, throws error for legacy IDs
 */
export function checkId(id: string): void {
    if (!id.includes("-")) {
        throw new Error("OLD ID: PLEASE REFRESH AND CLEAR ORPHANED CHAPTERS");
    }
}

/**
 * Fetches and parses JSON response from API
 */
export async function fetchJSON<T>(request: Request): Promise<T> {
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json: T =
        typeof data === "string" ? (JSON.parse(data) as T) : (data as T);
    if (response.status !== 200) {
        console.log(`Failed to fetch json results for ${request.url}`);
    }
    return json;
}