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
}

func Run(opts Options, onLog func(string)) (string, error) {
	before, err := snapMp3s(opts.OutputDir)
	if err != nil {
		return "", fmt.Errorf("snapshot dir: %w", err)
	}

	ytDlp := filepath.Join(opts.BinDir, "yt-dlp.exe")
	args := []string{
		opts.URL,
		"-f", "bestaudio",
		"--extract-audio",
		"--audio-format", "mp3",
		"--audio-quality", "0",
		"--output", filepath.Join(opts.OutputDir, "%(title)s.%(ext)s"),
		"--embed-thumbnail",
		"--convert-thumbnails", "jpg",
		"--no-playlist",
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

	// Split on both \n and \r so progress updates emit individually
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

// scanCR is a bufio.SplitFunc that splits on \r or \n, whichever comes first.
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
