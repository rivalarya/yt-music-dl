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
	"yt-music-dl/internal/metadata"
	"yt-music-dl/internal/settings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct{ ctx context.Context }

func NewApp() *App                         { return &App{} }
func (a *App) startup(ctx context.Context) { a.ctx = ctx }

func (a *App) CheckDeps() (deps.DepStatus, error) { return deps.Check() }
func (a *App) InstallYtDlp() error {
	return deps.InstallYtDlp(func(msg string) { runtime.EventsEmit(a.ctx, "deps:log", msg) })
}
func (a *App) InstallFfmpeg() error {
	return deps.InstallFfmpeg(func(msg string) { runtime.EventsEmit(a.ctx, "deps:log", msg) })
}
func (a *App) InstallDeno() error {
	return deps.InstallDeno(func(msg string) { runtime.EventsEmit(a.ctx, "deps:log", msg) })
}
func (a *App) GetSettings() (settings.Settings, error) { return settings.Load() }
func (a *App) SaveSettings(s settings.Settings) error  { return settings.Save(s) }

func (a *App) SaveCookieFile(content string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cookiePath := filepath.Join(filepath.Dir(exe), "cookies.txt")
	if err := os.WriteFile(cookiePath, []byte(content), 0644); err != nil {
		return err
	}
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
	return deezer.Search(query)
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

	go func() {
		mp3Path, err := downloader.Run(downloader.Options{
			URL:        url,
			OutputDir:  s.OutputDir,
			CookiePath: s.CookiePath,
			BinDir:     binDir,
			UseDeno:    depStatus.Deno,
		}, func(line string) {
			runtime.EventsEmit(a.ctx, "download:log", line)
		})
		if err != nil {
			runtime.EventsEmit(a.ctx, "download:error", err.Error())
			return
		}
		title := strings.TrimSuffix(filepath.Base(mp3Path), ".mp3")
		runtime.EventsEmit(a.ctx, "download:ready", DownloadReady{Path: mp3Path, Title: title})
	}()
	return nil
}

type TagRequest struct {
	Mp3Path string       `json:"mp3Path"`
	Track   deezer.Track `json:"track"`
}

func (a *App) TagFile(req TagRequest) error {
	runtime.EventsEmit(a.ctx, "download:log", "[tagging] embedding metadata...")
	if err := metadata.Tag(req.Mp3Path, metadata.Tags{
		Title:    req.Track.Title,
		Artist:   req.Track.Artist,
		Album:    req.Track.Album,
		CoverURL: req.Track.CoverURL,
	}); err != nil {
		runtime.EventsEmit(a.ctx, "download:log", fmt.Sprintf("[warn] tagging failed: %v", err))
	}
	runtime.EventsEmit(a.ctx, "download:done", req.Mp3Path)
	return nil
}

func (a *App) SelectOutputDir() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Output Directory",
	})
}
