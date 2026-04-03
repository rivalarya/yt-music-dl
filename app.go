package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"yt-music-dl/internal/deezer"
	"yt-music-dl/internal/deps"
	"yt-music-dl/internal/downloader"
	"yt-music-dl/internal/logger"
	"yt-music-dl/internal/metadata"
	"yt-music-dl/internal/settings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct{ ctx context.Context }

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

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

func (a *App) GetSettings() (settings.Settings, error) {
	return settings.Load()
}

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

	logger.Log.WithField("url", url).Info("starting download")

	go func() {
		mp3Path, err := downloader.Run(downloader.Options{
			URL:        url,
			OutputDir:  s.OutputDir,
			CookiePath: s.CookiePath,
			BinDir:     binDir,
			UseDeno:    depStatus.Deno,
		}, func(line string) {
			logger.Log.Info("[yt-dlp] " + line)
			runtime.EventsEmit(a.ctx, "download:log", line)
		})
		if err != nil {
			logger.Log.WithError(err).Error("download failed")
			runtime.EventsEmit(a.ctx, "download:error", err.Error())
			return
		}
		title := strings.TrimSuffix(filepath.Base(mp3Path), ".mp3")
		logger.Log.WithField("path", mp3Path).Info("download complete")
		runtime.EventsEmit(a.ctx, "download:ready", DownloadReady{Path: mp3Path, Title: title})
	}()
	return nil
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

// GetLogDir returns the path to the logs directory so the frontend can open it.
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

// LogFrontend receives a log line emitted by the frontend and writes it via logrus.
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
