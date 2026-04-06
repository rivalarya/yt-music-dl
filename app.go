package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"yt-music-dl/internal/deezer"
	"yt-music-dl/internal/deps"
	"yt-music-dl/internal/downloader"
	"yt-music-dl/internal/logger"
	"yt-music-dl/internal/metadata"
	"yt-music-dl/internal/settings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx      context.Context
	cancelDl context.CancelFunc
	cancelMu sync.Mutex
}

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

func (a *App) CheckDeps() (deps.DepStatus, error) {
	logger.Log.Info("checking dependencies")
	status, err := deps.Check()
	if err != nil {
		logger.Log.WithError(err).Error("dep check failed")
	}
	return status, err
}

func (a *App) InstallYtDlp() error {
	logger.Log.Info("installing yt-dlp")
	return deps.InstallYtDlp(func(msg string) {
		logger.Log.Info("[yt-dlp install] " + msg)
		runtime.EventsEmit(a.ctx, "deps:log", msg)
	})
}

func (a *App) InstallFfmpeg() error {
	logger.Log.Info("installing ffmpeg")
	return deps.InstallFfmpeg(func(msg string) {
		logger.Log.Info("[ffmpeg install] " + msg)
		runtime.EventsEmit(a.ctx, "deps:log", msg)
	})
}

func (a *App) InstallDeno() error {
	logger.Log.Info("installing deno")
	return deps.InstallDeno(func(msg string) {
		logger.Log.Info("[deno install] " + msg)
		runtime.EventsEmit(a.ctx, "deps:log", msg)
	})
}

func (a *App) GetSettings() (settings.Settings, error) { return settings.Load() }

func (a *App) SaveSettings(s settings.Settings) error {
	logger.Log.WithField("outputDir", s.OutputDir).Info("saving settings")
	return settings.Save(s)
}

func (a *App) SaveCookieFile(content string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cookiePath := filepath.Join(filepath.Dir(exe), "cookies.txt")
	if err := os.WriteFile(cookiePath, []byte(content), 0644); err != nil {
		return err
	}
	logger.Log.WithField("path", cookiePath).Info("cookie file saved")
	s, err := settings.Load()
	if err != nil {
		return err
	}
	s.CookiePath = cookiePath
	return settings.Save(s)
}

func (a *App) OpenFolder(path string) error {
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(path, 0755); err != nil {
		return err
	}
	return exec.Command("explorer", path).Start()
}

func (a *App) SearchDeezer(query string) ([]deezer.Track, error) {
	logger.Log.WithField("query", query).Info("searching deezer")
	tracks, err := deezer.Search(query)
	if err != nil {
		logger.Log.WithError(err).Error("deezer search failed")
	}
	return tracks, err
}

type DownloadReady struct {
	Path  string `json:"path"`
	Title string `json:"title"`
}

// TrackReady is emitted per-track for both single and playlist downloads.
type TrackReady struct {
	Path  string        `json:"path"`
	Title string        `json:"title"`
	Track *deezer.Track `json:"track"`
	Index int           `json:"index"` // 1-based, playlist position
	Total int           `json:"total"` // 0 if unknown (single track)
}

func (a *App) CancelDownload() {
	a.cancelMu.Lock()
	defer a.cancelMu.Unlock()
	if a.cancelDl != nil {
		logger.Log.Info("cancelling download")
		a.cancelDl()
		a.cancelDl = nil
	}
}

func (a *App) StartDownload(url string) error {
	s, err := settings.Load()
	if err != nil {
		return err
	}

	binDir, err := deps.BinDir()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(s.OutputDir, 0755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}

	depStatus, err := deps.Check()
	if err != nil {
		return err
	}

	isPlaylist := downloader.IsPlaylistURL(url)
	logger.Log.WithFields(map[string]interface{}{
		"url":        url,
		"isPlaylist": isPlaylist,
	}).Info("starting download")

	ctx, cancel := context.WithCancel(context.Background())
	a.cancelMu.Lock()
	a.cancelDl = cancel
	a.cancelMu.Unlock()

	go func() {
		defer func() {
			a.cancelMu.Lock()
			a.cancelDl = nil
			a.cancelMu.Unlock()
		}()

		trackIndex := 0
		mp3Path, err := downloader.Run(downloader.Options{
			URL:        url,
			OutputDir:  s.OutputDir,
			CookiePath: s.CookiePath,
			BinDir:     binDir,
			UseDeno:    depStatus.Deno,
			IsPlaylist: isPlaylist,
			Ctx:        ctx,
			OnFile: func(path string) {
				trackIndex++
				idx := trackIndex
				go a.processTrack(path, idx, 0)
			},
		}, func(line string) {
			logger.Log.Info("[yt-dlp] " + line)
			runtime.EventsEmit(a.ctx, "download:log", line)
		})

		if err != nil {
			if err == context.Canceled {
				logger.Log.Info("download cancelled")
				runtime.EventsEmit(a.ctx, "download:cancelled", nil)
				return
			}
			logger.Log.WithError(err).Error("download failed")
			runtime.EventsEmit(a.ctx, "download:error", err.Error())
			return
		}

		if !isPlaylist && mp3Path != "" && trackIndex == 0 {
			go func() {
				a.processTrack(mp3Path, 1, 0)
				runtime.EventsEmit(a.ctx, "download:done", nil)
			}()
		}

		if isPlaylist {
			runtime.EventsEmit(a.ctx, "download:playlist-done", nil)
		}
	}()

	return nil
}

func (a *App) processTrack(mp3Path string, index int, total int) {
	filename := strings.TrimSuffix(filepath.Base(mp3Path), ".mp3")

	if idx := strings.Index(filename, " - "); idx != -1 {
		candidate := filename[idx+3:]
		if candidate != "" {
			filename = candidate
		}
	}

	logger.Log.WithFields(map[string]interface{}{
		"path":  mp3Path,
		"query": filename,
		"index": index,
	}).Info("processing track")

	var matched *deezer.Track
	tracks, err := deezer.Search(filename)
	if err != nil {
		logger.Log.WithError(err).Warn("deezer search failed")
	} else if len(tracks) > 0 {
		matched = &tracks[0]
	}

	if matched != nil {
		if err := metadata.Tag(mp3Path, metadata.Tags{
			Title:    matched.Title,
			Artist:   matched.Artist,
			Album:    matched.Album,
			CoverURL: matched.CoverURL,
		}); err != nil {
			logger.Log.WithError(err).Warn("tagging failed")
		}
	}

	runtime.EventsEmit(a.ctx, "download:track", TrackReady{
		Path:  mp3Path,
		Title: filename,
		Track: matched,
		Index: index,
		Total: total,
	})
}

type TagRequest struct {
	Mp3Path string       `json:"mp3Path"`
	Track   deezer.Track `json:"track"`
}

func (a *App) TagFile(req TagRequest) error {
	logger.Log.WithFields(map[string]interface{}{
		"path":   req.Mp3Path,
		"title":  req.Track.Title,
		"artist": req.Track.Artist,
	}).Info("tagging file")

	if err := metadata.Tag(req.Mp3Path, metadata.Tags{
		Title:    req.Track.Title,
		Artist:   req.Track.Artist,
		Album:    req.Track.Album,
		CoverURL: req.Track.CoverURL,
	}); err != nil {
		logger.Log.WithError(err).Warn("tagging failed")
	}

	runtime.EventsEmit(a.ctx, "download:done", req.Mp3Path)
	return nil
}

func (a *App) SelectOutputDir() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Output Directory",
	})
}

func (a *App) GetLogDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := logger.LogDir(filepath.Dir(exe))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

func (a *App) LogFrontend(level, msg string) {
	entry := logger.Log.WithField("source", "frontend")
	switch level {
	case "error":
		entry.Error(msg)
	case "warn":
		entry.Warn(msg)
	default:
		entry.Info(msg)
	}
}
