const SECTION_PREFIX = "smartfilter-";

// Kavita FilterEntityType: smart filters can also target people, reading lists...
export const SERIES_ENTITY_TYPE = 0;

/**
 * Discover section id of a Kavita smart filter ("smartfilter-3").
 */
export function smartFilterSectionId(id: number): string {
    return `${SECTION_PREFIX}${id}`;
}

/**
 * Smart filter id of a discover section id, if it is one.
 */
export function parseSmartFilterSectionId(
    sectionId: string,
): number | undefined {
    const match = /^smartfilter-(\d+)$/.exec(sectionId);
    return match?.[1] ? parseInt(match[1]) : undefined;
}
