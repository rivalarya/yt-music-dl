package downloader

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type Options struct {
	URL        string
	OutputDir  string
	CookiePath string
	BinDir     string
}

// Run executes yt-dlp and calls onLog for every line of output.
// Returns the path to the downloaded mp3 by diffing the output dir.
func Run(opts Options, onLog func(string)) (string, error) {
	before, err := snapMp3s(opts.OutputDir)
	if err != nil {
		return "", fmt.Errorf("snapshot dir: %w", err)
	}

	ytDlp := filepath.Join(opts.BinDir, "yt-dlp.exe")
	// deno := filepath.Join(opts.BinDir, "deno.exe")

	args := []string{
		opts.URL,
		"-f", "bestaudio",
		"--extract-audio",
		"--audio-format", "mp3",
		"--audio-quality", "0",
		"--output", filepath.Join(opts.OutputDir, "%(title)s.%(ext)s"),
		"--js-runtime", "deno",
		"--remote-components", "ejs:github",
		"--no-playlist",
	}
	if opts.CookiePath != "" {
		args = append(args, "--cookies", opts.CookiePath)
	}

	cmd := exec.Command(ytDlp, args...)

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
		for scanner.Scan() {
			onLog(scanner.Text())
		}
		done <- struct{}{}
	}
	go stream(stdout)
	go stream(stderr)
	<-done
	<-done

	if err := cmd.Wait(); err != nil {
		return "", fmt.Errorf("yt-dlp exited: %w", err)
	}

	after, err := snapMp3s(opts.OutputDir)
	if err != nil {
		return "", fmt.Errorf("read dir after download: %w", err)
	}

	for name := range after {
		if _, existed := before[name]; !existed {
			return filepath.Join(opts.OutputDir, name), nil
		}
	}
	return "", fmt.Errorf("download finished but no new mp3 found in %s", opts.OutputDir)
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