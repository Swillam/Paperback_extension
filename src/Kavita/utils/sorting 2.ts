import type { SortingOption } from "@paperback/types";

// Kavita SeriesSortField enum values
const SORT_FIELD = {
    name: 1,
    created: 2,
    lastChapterAdded: 4,
    releaseYear: 6,
    averageRating: 8,
    random: 9,
} as const;

interface KavitaSort {
    sortField: number;
    isAscending: boolean;
}

const SORTS: (SortingOption & KavitaSort)[] = [
    {
        id: "name-asc",
        label: "Name (A-Z)",
        sortField: SORT_FIELD.name,
        isAscending: true,
    },
    {
        id: "name-desc",
        label: "Name (Z-A)",
        sortField: SORT_FIELD.name,
        isAscending: false,
    },
    {
        id: "updated",
        label: "Recently updated",
        sortField: SORT_FIELD.lastChapterAdded,
        isAscending: false,
    },
    {
        id: "added",
        label: "Recently added",
        sortField: SORT_FIELD.created,
        isAscending: false,
    },
    {
        id: "year-desc",
        label: "Release year (newest)",
        sortField: SORT_FIELD.releaseYear,
        isAscending: false,
    },
    {
        id: "year-asc",
        label: "Release year (oldest)",
        sortField: SORT_FIELD.releaseYear,
        isAscending: true,
    },
    {
        id: "rating",
        label: "Rating (highest)",
        sortField: SORT_FIELD.averageRating,
        isAscending: false,
    },
    {
        id: "random",
        label: "Random",
        sortField: SORT_FIELD.random,
        isAscending: true,
    },
];

const DEFAULT_SORT: KavitaSort = {
    sortField: SORT_FIELD.name,
    isAscending: true,
};

/**
 * Sorting options offered to Paperback.
 */
export function getSortingOptionList(): SortingOption[] {
    return SORTS.map(({ id, label }) => ({ id, label }));
}

/**
 * Kavita sort options for a Paperback sorting option id (name A-Z by default).
 */
export function kavitaSortFor(id: string | undefined): KavitaSort {
    const sort = SORTS.find((s) => s.id === id);
    return sort
        ? { sortField: sort.sortField, isAscending: sort.isAscending }
        : DEFAULT_SORT;
}
