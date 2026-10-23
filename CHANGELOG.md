# Changelog

Changes to the Kavita extension, newest first. The extension is in alpha: it follows the alpha of Paperback itself.

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
