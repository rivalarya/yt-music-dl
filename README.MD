# yt-music-dl

Download YouTube Music tracks as MP3 with metadata (title, artist, album) from Deezer embedded automatically.

Built with [Wails](https://wails.io/) (Go + Next.js).

---

## Installation

1. Download the latest release [here](https://github.com/rivalarya/yt-music-dl/releases/latest/download/yt-music-dl-amd64-installer.exe).
2. Run the installer and open the App.
3. Open **Settings** and install the required dependencies:
   - **yt-dlp** — downloads audio from YouTube Music
   - **ffmpeg** — converts audio to MP3

> The app checks for `ffmpeg` and `deno` on your system `PATH` first. If found, they are used as-is and the install button is hidden.

The app will show a warning banner on startup if required dependencies are missing.

### Optional: Deno

yt-dlp ships with a built-in JavaScript runtime. When YouTube updates break it, Deno provides a more reliable fallback. Install it from Settings if you hit extraction errors.

### Optional: YouTube Cookie

If downloads fail due to bot detection or age-restricted content:

1. Install the Chrome extension **"Get cookies.txt LOCALLY"**.
2. Go to [youtube.com](https://www.youtube.com) while logged in.
3. Click the extension → Export cookies.
4. In **Settings → YouTube Cookie**, paste the file contents.

---

## Usage

1. Copy a YouTube Music track URL.
2. Paste it into the URL field and click **Download**.
3. yt-dlp downloads the audio and converts it to MP3.
4. The app searches Deezer using the video title and automatically embeds the first matching track's metadata (title, artist, album, cover art).
5. The MP3 is saved to your configured output directory (`~/Music` by default).

If no Deezer match is found, the file is saved without metadata.

---

## Settings

| Setting | Description |
|---|---|
| Output directory | Where MP3 files are saved. Defaults to `~/Music`. |
| yt-dlp | Download/update the bundled yt-dlp binary. |
| ffmpeg | Download/update the bundled ffmpeg binary. |
| Deno | Optional. Install if yt-dlp's built-in JS runtime breaks. |
| YouTube Cookie | Paste `cookies.txt` content to bypass bot detection. |

---

## Bug Reporting

Click the **bug icon** in the top bar. The dialog walks you through opening the log folder (`logs/app.log`) and filing a GitHub issue with the relevant log lines.

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

Project structure:

```
app.go                    # Wails app bindings
main.go                   # Entry point
internal/
  deezer/                 # Deezer search API
  deps/                   # Dependency install/check (yt-dlp, ffmpeg, deno)
  downloader/             # yt-dlp subprocess wrapper
  logger/                 # Logrus + log rotation
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
- [x] Playlist download support
- [ ] Download queue / batch mode