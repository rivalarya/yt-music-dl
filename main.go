package main

import (
	"embed"
	"os"
	"path/filepath"
	"yt-music-dl/internal/logger"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/out
var assets embed.FS

func main() {
	exe, err := os.Executable()
	if err == nil {
		logger.Init(filepath.Dir(exe))
	}
	logger.Log.Info("app starting")

	app := NewApp()
	err = wails.Run(&options.App{
		Title:  "YT Music Downloader",
		Width:  900,
		Height: 680,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 9, G: 9, B: 11, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		logger.Log.WithError(err).Fatal("wails run failed")
	}
}
