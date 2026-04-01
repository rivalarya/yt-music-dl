package deps

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

type DepStatus struct {
	YtDlp  bool `json:"ytDlp"`
	Ffmpeg bool `json:"ffmpeg"`
	Deno   bool `json:"deno"`
}

const (
	ytDlpURL  = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
	ffmpegURL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
	denoURL   = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
)

// BinDir returns the bin/ folder next to the executable.
func BinDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(filepath.Dir(exe), "bin")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

func Check() (DepStatus, error) {
	bin, err := BinDir()
	if err != nil {
		return DepStatus{}, err
	}
	return DepStatus{
		YtDlp:  fileExists(filepath.Join(bin, "yt-dlp.exe")),
		Ffmpeg: fileExists(filepath.Join(bin, "ffmpeg.exe")),
		Deno:   fileExists(filepath.Join(bin, "deno.exe")),
	}, nil
}

// Install downloads all missing deps. onProgress receives a status string for the log.
func Install(onProgress func(string)) error {
	bin, err := BinDir()
	if err != nil {
		return err
	}

	type dep struct {
		name    string
		path    string
		url     string
		extract func(data []byte, destDir string) error
	}

	deps := []dep{
		{
			name:    "yt-dlp",
			path:    filepath.Join(bin, "yt-dlp.exe"),
			url:     ytDlpURL,
			extract: writeSingle,
		},
		{
			name:    "deno",
			path:    filepath.Join(bin, "deno.exe"),
			url:     denoURL,
			extract: extractFirstExeFromZip,
		},
		{
			name: "ffmpeg",
			path: filepath.Join(bin, "ffmpeg.exe"),
			url:  ffmpegURL,
			extract: func(data []byte, destDir string) error {
				return extractNamedFromZip(data, destDir, "ffmpeg.exe")
			},
		},
	}

	for _, d := range deps {
		if fileExists(d.path) {
			onProgress(fmt.Sprintf("[skip] %s already exists", d.name))
			continue
		}
		onProgress(fmt.Sprintf("[download] %s ...", d.name))
		data, err := download(d.url)
		if err != nil {
			return fmt.Errorf("download %s: %w", d.name, err)
		}
		onProgress(fmt.Sprintf("[extract] %s ...", d.name))
		if err := d.extract(data, bin); err != nil {
			return fmt.Errorf("extract %s: %w", d.name, err)
		}
		onProgress(fmt.Sprintf("[done] %s", d.name))
	}
	return nil
}

func download(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func writeSingle(data []byte, destDir string) error {
	// For yt-dlp — the download IS the exe
	// filename is derived from the URL's last segment; hardcode yt-dlp.exe
	return os.WriteFile(filepath.Join(destDir, "yt-dlp.exe"), data, 0755)
}

func extractFirstExeFromZip(data []byte, destDir string) error {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	for _, f := range zr.File {
		if filepath.Ext(f.Name) == ".exe" {
			return extractZipFile(f, filepath.Join(destDir, filepath.Base(f.Name)))
		}
	}
	return fmt.Errorf("no exe found in zip")
}

func extractNamedFromZip(data []byte, destDir, name string) error {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	for _, f := range zr.File {
		if filepath.Base(f.Name) == name {
			return extractZipFile(f, filepath.Join(destDir, name))
		}
	}
	return fmt.Errorf("%s not found in zip", name)
}

func extractZipFile(f *zip.File, dest string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, rc)
	return err
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}