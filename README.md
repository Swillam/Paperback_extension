# Swillam Extensions

Paperback (0.9) extensions by Swillam.

## Available Extensions

### Kavita

Client extension to read a self-hosted [Kavita](https://www.kavitareader.com) library in Paperback.

- Discover sections: on deck, latest updates, recently added, tags, your libraries and your Kavita smart filters (each can be hidden)
- Search by title, genre, tag and people with include/exclude filters, plus library, publication status and read state, and several sort orders
- Chapters and pages served directly from your Kavita server
- Reading progress synced both ways (continue point, mark read/unread)
- Want to Read and your collections as Paperback library collections
- Series updates checked in batches

> [!NOTE]
> The extension is in alpha and was tested with Kavita 0.9. The settings recommend Kavita 0.8 or newer. See the [changelog](CHANGELOG.md).

#### Setup

In the extension settings, enter:

- the URL of your Kavita server (for example `http://192.168.1.10:5000`, the `/api` suffix is added automatically)
- your Kavita API key (Kavita: _User Settings → Account → API Key_)

## Installation

Add this repository to Paperback by visiting the [installation page][installation-webpage].

## Development

```bash
npm ci
npm run dev    # serve the extensions with live reload
npm test       # tsc, eslint, prettier and bundle, same as the CI
```

## License

See [LICENSE](LICENSE).

[installation-webpage]: https://swillam.github.io/Paperback_extension/0.9/stable
