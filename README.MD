# yt-music-dl

Download YouTube Music tracks as MP3 with Deezer metadata (title, artist, album) embedded automatically.

Built with [Wails](https://wails.io/) (Go + Next.js).

---

## Installation

1. Download the latest release from [Releases](https://github.com/rivalarya/yt-music-dl/releases).
2. Extract and run `yt-music-dl.exe`.
3. Open **Settings** and install the required dependencies:
   - **yt-dlp** — required, downloads audio from YouTube Music
   - **ffmpeg** — required, converts audio to MP3

> **Note:** The app checks for `ffmpeg` and `deno` on your system `PATH` first. If found, it uses those and skips the install button. You only need to install them via Settings if they are missing from your system.

### Optional: Deno

Deno is optional. yt-dlp uses a built-in JavaScript runtime by default. If YouTube updates break that runtime, installing Deno provides a more stable alternative. Install it from Settings if you run into extraction errors.

### Optional: YouTube Cookie

If downloads fail (bot detection or age-restricted content), provide your browser cookies:

1. Install the Chrome extension **"Get cookies.txt LOCALLY"**.
2. Go to [youtube.com](https://www.youtube.com) while logged in.
3. Click the extension → Export cookies.
4. In Settings → YouTube Cookie → paste the file contents.

---

## Usage

1. Copy a YouTube Music track URL.
2. Paste it into the URL field.
3. Optionally enter a Deezer search query to help match the correct metadata (defaults to the video title).
4. Click **Download**.
5. Select the correct track from Deezer results, or enable **Auto-select first result** in Settings to skip this step.

The MP3 is saved to your configured output directory (`~/Music` by default) with title, artist, album, and cover art embedded.

---

## Contributing

Contributions are welcome.

```bash
# Prerequisites: Go, Node.js, pnpm, Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

git clone https://github.com/rivalarya/yt-music-dl.git
cd yt-music-dl
wails dev
```

Build a release binary:

```bash
wails build
```

The project structure:

```
app.go                    # Wails app bindings
main.go                   # Entry point
internal/
  deezer/                 # Deezer search API
  deps/                   # Dependency install/check (yt-dlp, ffmpeg, deno)
  downloader/             # yt-dlp subprocess wrapper
  metadata/               # ID3 tag writer
  settings/               # Settings persistence
frontend/
  app/                    # Next.js pages
  components/             # UI components
  lib/                    # Wails bindings + utilities
```

Please keep PRs focused. Open an issue first for larger changes.

---

## Roadmap

- [ ] macOS support
- [ ] Linux support
- [ ] Playlist download support
- [ ] Download queue / batch mode