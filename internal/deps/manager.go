package deps

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"yt-music-dl/internal/logger"
)

type DepStatus struct {
	YtDlp         bool   `json:"ytDlp"`
	YtDlpVersion  string `json:"ytDlpVersion"`
	Ffmpeg        bool   `json:"ffmpeg"`
	FfmpegSystem  bool   `json:"ffmpegSystem"`
	FfmpegVersion string `json:"ffmpegVersion"`
	Deno          bool   `json:"deno"`
	DenoSystem    bool   `json:"denoSystem"`
	DenoVersion   string `json:"denoVersion"`
}

const (
	ytDlpURL  = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
	ffmpegURL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
	denoURL   = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
)

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

func isOnPath(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func runOutput(bin string, args ...string) string {
	cmd := exec.Command(bin, args...)

	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	out, err := cmd.Output()
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(out))
}

// ytDlpVersion: first line of "yt-dlp --version" → "2026.03.17"
func parseYtDlpVersion(bin string) string {
	out := runOutput(bin, "--version")
	return strings.SplitN(out, "\n", 2)[0]
}

// ffmpegVersion: first line is "ffmpeg version N-118487-gb92... ..."
// For nightly builds, trim to the commit short hash prefix. For release builds, keep the semver.
// Either way, just take the third field (index 2).
func parseFfmpegVersion(bin string, args ...string) string {
	out := runOutput(bin, args...)
	// first line: "ffmpeg version <token> ..."
	line := strings.SplitN(out, "\n", 2)[0]
	parts := strings.Fields(line)
	// parts: ["ffmpeg", "version", "<ver>", ...]
	if len(parts) >= 3 {
		v := parts[2]
		// nightly: "N-118487-gb92577405b-20250217" → trim after second dash to "N-118487"
		if strings.HasPrefix(v, "N-") {
			segments := strings.SplitN(v, "-", 3)
			if len(segments) >= 2 {
				return segments[0] + "-" + segments[1]
			}
		}
		return v
	}
	return line
}

// denoVersion: "deno 2.7.10 (stable, release, x86_64-pc-windows-msvc)" → "2.7.10"
func parseDenoVersion(bin string) string {
	out := runOutput(bin, "--version")
	line := strings.SplitN(out, "\n", 2)[0]
	// line: "deno <version> (...)"
	parts := strings.Fields(line)
	if len(parts) >= 2 {
		return parts[1]
	}
	return line
}

func Check() (DepStatus, error) {
	bin, err := BinDir()
	if err != nil {
		return DepStatus{}, err
	}

	ffmpegSystem := isOnPath("ffmpeg")
	denoSystem := isOnPath("deno")

	ytDlpPath := filepath.Join(bin, "yt-dlp.exe")
	ffmpegBinPath := filepath.Join(bin, "ffmpeg.exe")
	denoBinPath := filepath.Join(bin, "deno.exe")

	status := DepStatus{
		FfmpegSystem: ffmpegSystem,
		DenoSystem:   denoSystem,
	}

	if fileExists(ytDlpPath) {
		status.YtDlp = true
		status.YtDlpVersion = parseYtDlpVersion(ytDlpPath)
		logger.Log.WithField("version", status.YtDlpVersion).Debug("yt-dlp found")
	}
	if ffmpegSystem {
		status.Ffmpeg = true
		status.FfmpegVersion = parseFfmpegVersion("ffmpeg", "-version")
		logger.Log.WithField("version", status.FfmpegVersion).Debug("ffmpeg found (system)")
	} else if fileExists(ffmpegBinPath) {
		status.Ffmpeg = true
		status.FfmpegVersion = parseFfmpegVersion(ffmpegBinPath, "-version")
		logger.Log.WithField("version", status.FfmpegVersion).Debug("ffmpeg found (bin)")
	}
	if denoSystem {
		status.Deno = true
		status.DenoVersion = parseDenoVersion("deno")
		logger.Log.WithField("version", status.DenoVersion).Debug("deno found (system)")
	} else if fileExists(denoBinPath) {
		status.Deno = true
		status.DenoVersion = parseDenoVersion(denoBinPath)
		logger.Log.WithField("version", status.DenoVersion).Debug("deno found (bin)")
	}

	return status, nil
}

func InstallYtDlp(onProgress func(string)) error {
	return installDep("yt-dlp", ytDlpURL, writeSingle("yt-dlp.exe"), onProgress)
}

func InstallFfmpeg(onProgress func(string)) error {
	return installDep("ffmpeg", ffmpegURL, func(data []byte, destDir string) error {
		return extractNamedFromZip(data, destDir, "ffmpeg.exe")
	}, onProgress)
}

func InstallDeno(onProgress func(string)) error {
	return installDep("deno", denoURL, extractFirstExeFromZip, onProgress)
}

func installDep(name, url string, extract func([]byte, string) error, onProgress func(string)) error {
	bin, err := BinDir()
	if err != nil {
		return err
	}
	logger.Log.WithFields(map[string]interface{}{"dep": name, "url": url}).Info("downloading dep")
	data, err := downloadWithProgress(url, onProgress)
	if err != nil {
		logger.Log.WithError(err).Errorf("download %s failed", name)
		return fmt.Errorf("download %s: %w", name, err)
	}
	onProgress("[extract] installing...")
	if err := extract(data, bin); err != nil {
		logger.Log.WithError(err).Errorf("extract %s failed", name)
		return fmt.Errorf("extract %s: %w", name, err)
	}
	logger.Log.WithField("dep", name).Info("dep installed")
	onProgress("[done]")
	return nil
}

func downloadWithProgress(url string, onProgress func(string)) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	total := resp.ContentLength // -1 if unknown
	buf := &bytes.Buffer{}
	chunk := make([]byte, 32*1024) // 32 KB chunks
	var downloaded int64
	lastPct := -1

	for {
		n, err := resp.Body.Read(chunk)
		if n > 0 {
			buf.Write(chunk[:n])
			downloaded += int64(n)
			if total > 0 {
				pct := int(downloaded * 100 / total)
				if pct != lastPct {
					lastPct = pct
					onProgress(fmt.Sprintf("[progress] %d", pct))
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

func writeSingle(filename string) func([]byte, string) error {
	return func(data []byte, destDir string) error {
		return os.WriteFile(filepath.Join(destDir, filename), data, 0755)
	}
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
