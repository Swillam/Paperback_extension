# Changelog

Changes to the Kavita extension, newest first.

## 1.0.2

- Fix: scrolling a list or a search failed with `metadata.collectedIds: Expected value of type JSONValue, found undefined` (introduced by 1.0.1). The metadata of a page now only holds the page number.

## 1.0.1

- Fix: the lists of a library, On Deck and Latest Updates stopped at one page (20 titles by default). They now keep loading while you scroll, like the other sections.
- Fix: a title search could never show more than 15 series (a limit of Kavita's search). It now finds every series whose name contains the text, in the sort you chose.
- The search by people, genre or tag reads up to 1000 series instead of one page.

## 1.0.0

First stable version. It gathers everything from the alpha releases below, plus:

- **Settings** are split by theme (Server, Home, Search & Lists, Updates) with a Reset Settings button that keeps the server and the API key. The API key is hidden.
- Changing a Home setting reloads Discover by itself, and the order of the Discover groups can be changed.
- **Update settings**: optimized updates on/off, skip by unread chapters, new chapters or publication status.
- A request that hits an expired sign-in is sent once more instead of failing, and failed progress writes are reported.
- Test Connection recommends Kavita 0.8 or newer when the server is older.
- The page size is set with a stepper.
- Documentation: this changelog and an updated README.

## 1.0.0-alpha.19

- The update check stores the "last chapter added" of each series and asks Kavita about up to 100 series per request. Only series with a new chapter are left to Paperback (before, one request per series and nothing was ever seen as unchanged).

## 1.0.0-alpha.18

- Your Kavita **collections** appear in the Paperback library next to Want to Read (list, add, remove).
- Kavita **smart filters** (series) appear as carousels in Discover, with a toggle in the settings.
- Fix: Recently Added always asked for page 1.

## 1.0.0-alpha.17

- **Want to Read** is a library collection.
- **Sorting**: name, recently updated, recently added, release year, rating, random.
- New search filters: library, publication status, read state. An empty search browses the library.
- Fix: library sections showed only part of a library (a page of all series filtered afterwards).
- Settings: choose which Discover sections are shown.

## 1.0.0-alpha.16

- **Test Connection** button in the server settings.
- Fix: genre, tag and people search answered an error (Kavita expects ids, not titles); exclusions now work with every include/exclude operator.
- Alternative titles are no longer repeated; year, language, publisher, translators and characters are added to the synopsis.
- Chapters are cached for a few seconds.
- The page size is validated (1-200, 20 by default).

## 1.0.0-alpha.15

- Fix: reading progress was never synced (wrong URL), read chapters were detected the wrong way round, and the progress sent to Kavita had the wrong ids.
- Requests that Kavita refuses now report an error instead of being parsed as data.
- The cached sign-in is dropped when the server URL or the API key changes.
