package downloader

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"yt-music-dl/internal/logger"
)

type Options struct {
	URL        string
	OutputDir  string
	CookiePath string
	BinDir     string
	UseDeno    bool
	IsPlaylist bool
	OnFile     func(path string)
}

func Run(opts Options, onLog func(string)) (string, error) {
	before, err := snapMp3s(opts.OutputDir)
	if err != nil {
		return "", fmt.Errorf("snapshot dir: %w", err)
	}

	ytDlp := filepath.Join(opts.BinDir, "yt-dlp.exe")

	outputTmpl := filepath.Join(opts.OutputDir, "%(title)s.%(ext)s")
	if opts.IsPlaylist {
		outputTmpl = filepath.Join(opts.OutputDir, "%(playlist_index)s - %(title)s.%(ext)s")
	}

	args := []string{
		opts.URL,
		"-f", "bestaudio",
		"--extract-audio",
		"--audio-format", "mp3",
		"--audio-quality", "0",
		"--output", outputTmpl,
		"--embed-thumbnail",
		"--convert-thumbnails", "jpg",
	}

	if opts.IsPlaylist {
		args = append(args, "--yes-playlist")
	} else {
		args = append(args, "--no-playlist")
	}

	if opts.UseDeno {
		args = append(args, "--js-runtime", "deno", "--remote-components", "ejs:github")
	}

	if opts.CookiePath != "" {
		args = append(args, "--cookies", opts.CookiePath)
	}

	logger.Log.WithField("args", args).Debug("running yt-dlp")

	cmd := exec.Command(ytDlp, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", err
	}

	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("start yt-dlp: %w", err)
	}

	done := make(chan struct{}, 2)

	stream := func(r interface{ Read([]byte) (int, error) }) {
		scanner := bufio.NewScanner(r)
		scanner.Split(scanCR)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				continue
			}
			logger.Log.Info("[yt-dlp] " + line)
			onLog(line)

			// Detect completed file from log line
			// Format: [ExtractAudio] Destination: Some Title [id].mp3
			if opts.OnFile != nil && strings.HasPrefix(line, "[ExtractAudio] Destination:") {
				dest := strings.TrimPrefix(line, "[ExtractAudio] Destination:")
				dest = strings.TrimSpace(dest)
				// dest may be just filename or full path depending on yt-dlp version
				if !filepath.IsAbs(dest) {
					dest = filepath.Join(opts.OutputDir, dest)
				}
				logger.Log.WithField("path", dest).Info("file ready via ExtractAudio log")
				opts.OnFile(dest)
			}
		}
		done <- struct{}{}
	}

	go stream(stdout)
	go stream(stderr)

	<-done
	<-done

	if err := cmd.Wait(); err != nil {
		logger.Log.WithError(err).Error("yt-dlp exited with error")
		return "", fmt.Errorf("yt-dlp exited: %w", err)
	}

	// For single track: return the new mp3 path via diff
	// For playlist: OnFile already called per track, return empty
	if opts.IsPlaylist {
		return "", nil
	}

	after, err := snapMp3s(opts.OutputDir)
	if err != nil {
		return "", fmt.Errorf("read dir after download: %w", err)
	}

	for name := range after {
		if _, existed := before[name]; !existed {
			path := filepath.Join(opts.OutputDir, name)
			logger.Log.WithField("path", path).Info("new mp3 detected")
			return path, nil
		}
	}

	return "", fmt.Errorf("download finished but no new mp3 found in %s", opts.OutputDir)
}

func scanCR(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	for i, b := range data {
		if b == '\r' || b == '\n' {
			return i + 1, data[:i], nil
		}
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil
}

func snapMp3s(dir string) (map[string]struct{}, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	m := make(map[string]struct{}, len(entries))
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".mp3" {
			m[e.Name()] = struct{}{}
		}
	}
	return m, nil
}

// IsPlaylistURL returns true if the URL points to a playlist rather than a single video.
func IsPlaylistURL(url string) bool {
	return strings.Contains(url, "playlist?list=") ||
		(strings.Contains(url, "list=") && !strings.Contains(url, "watch?v="))
}
