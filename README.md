# SubHut

A self-hosted Stremio subtitle addon built with TypeScript and the official
`stremio-addon-sdk`. Copy your subtitles into a folder and use them in Stremio.
No database, account, upload service, or external subtitle provider is required.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
```

Copy `.env.example` to `.env` and adjust it if needed, then run:

```sh
npm run dev
```

In Stremio's addon installation/search field, enter
`http://localhost:7000/manifest.json` and install SubHut. For a production build:

```sh
npm run build
npm start
```

## Add subtitles

Use this layout (season and episode directories are plain decimal numbers):

```text
subtitles/
  tt1254207/                  # Movie IMDb ID
    eng.srt
    eng.bluray.srt            # Another version in the same language
    srp.latin.srt
  tt0903747/                  # Series IMDb ID
    1/                       # Season 1
      2/                     # Episode 2
        eng.srt
        srp.vtt
    0/                       # Season 0 for specials
      1/
        eng.srt
```

Stremio sends movie IDs such as `tt1254207` and episode IDs such as
`tt0903747:1:2`. SubHut translates the latter into `tt0903747/1/2`, which also
works on Windows. Only IMDb movie and episode IDs are supported in this version.

Name files `<language>[.<variant>...].<extension>`. Use a lowercase three-letter
ISO 639-2 language code (`eng`, `srp`, `spa`, etc.). Language codes are passed
through to Stremio; SubHut checks the three-letter shape, not the ISO registry.
Variants may contain ASCII letters, numbers, underscores and hyphens, with dots
separating additional variants. Supported extensions are lowercase `srt`, `vtt`,
`ass`, and `ssa`. Save files as UTF-8; SubHut serves original bytes without
conversion or timing adjustment. Pick a subtitle that matches your video release.

Each request reads the requested folder, so additions and removals need no server
restart. Reopen playback if Stremio has already loaded its subtitle list. Files
with unsupported names, nested folders, and symbolic links inside the library
are ignored. Keep the library writable only by trusted administrators; when
copying large files, finish the copy with a rename to a supported filename.

## Configuration

Environment variables take precedence over `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listen address |
| `PORT` | `7000` | Listen port |
| `PUBLIC_URL` | `http://localhost:7000` | URL reachable by your Stremio device |
| `SUBTITLES_DIR` | `./subtitles` | Subtitle library, relative to the working directory or absolute |

For another device on your network, set `PUBLIC_URL` to your server's LAN URL,
for example `http://192.168.1.20:7000`, then install its `/manifest.json` URL.
`localhost` on a TV or phone refers to that device, not your server. For remote
access or HTTPS clients, use an HTTPS reverse proxy and set `PUBLIC_URL` to that
HTTPS URL. A URL path prefix is supported if the proxy strips that prefix before
forwarding requests to SubHut. Host/request headers never determine file URLs.

The addon is read-only and has no authentication: anyone who can reach it can
request subtitles by ID. Keep it on a trusted network or restrict access through
your hosting setup if the library is private. It is not published to Stremio's
community catalog automatically.

## Docker

Create the `subtitles` directory with the layout above, set `PUBLIC_URL` in `.env`
to an address reachable by your Stremio device, and run:

```sh
docker compose up --build -d
```

The container runs as a non-root user and mounts the library read-only. Ensure
the host files and directories are readable by the container user.

## Development

```sh
npm run check
```

This checks TypeScript, runs HTTP integration tests using temporary libraries,
and builds the application. Source is separated into configuration, filesystem
lookup, SDK registration, HTTP routes, and process startup. `GET /health` is a
liveness endpoint. Tests cover the SDK manifest and subtitle routes, downloads,
live file changes, missing entries, and invalid paths/symbolic links.

The dependency overrides pin patched versions of the SDK's older
`path-to-regexp` and `tmp` dependencies. HTTP tests exercise the SDK router with
these overrides; review them when updating the SDK.

Protocol references: [subtitle requests](https://stremio.github.io/stremio-addon-sdk/api/requests/defineSubtitlesHandler.html)
and [subtitle responses](https://stremio.github.io/stremio-addon-sdk/api/responses/subtitles.html).
