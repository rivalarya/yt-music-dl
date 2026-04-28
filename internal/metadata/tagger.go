package metadata

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"yt-music-dl/internal/logger"
)

type Tags struct {
	Title    string
	Artist   string
	Album    string
	CoverURL string
}

type ExistingTags struct {
	Title  string `json:"title"`
	Artist string `json:"artist"`
	Album  string `json:"album"`
}

type ffprobeOutput struct {
	Format struct {
		Tags struct {
			Title  string `json:"title"`
			Artist string `json:"artist"`
			Album  string `json:"album"`
		} `json:"tags"`
	} `json:"format"`
}

func Tag(mp3Path string, tags Tags, ffmpegBin string) error {
	logger.Log.WithFields(map[string]interface{}{
		"path":   mp3Path,
		"title":  tags.Title,
		"artist": tags.Artist,
		"album":  tags.Album,
	}).Info("writing tags via ffmpeg")

	tmp := mp3Path + ".tmp.mp3"
	defer os.Remove(tmp)

	var args []string

	if tags.CoverURL != "" {
		coverPath, err := fetchToTemp(tags.CoverURL)
		if err != nil {
			logger.Log.WithError(err).Warn("failed to fetch cover, tagging without it")
		} else {
			defer os.Remove(coverPath)
			args = buildArgsWithCover(mp3Path, coverPath, tmp, tags)
		}
	}

	if args == nil {
		args = buildArgsNoCover(mp3Path, tmp, tags)
	}

	cmd := exec.Command(ffmpegBin, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	out, err := cmd.CombinedOutput()
	if err != nil {
		logger.Log.WithField("ffmpeg_output", string(out)).WithError(err).Error("ffmpeg tagging failed")
		return fmt.Errorf("ffmpeg: %w", err)
	}

	if err := os.Rename(tmp, mp3Path); err != nil {
		return fmt.Errorf("replace original: %w", err)
	}

	logger.Log.Info("tags written")
	return nil
}

func ReadTags(mp3Path string) (ExistingTags, error) {
	ffprobePath := findFfprobe()
	if ffprobePath == "" {
		return ExistingTags{}, nil
	}

	cmd := exec.Command(ffprobePath,
		"-v", "quiet",
		"-print_format", "json",
		"-show_entries", "format_tags=title,artist,album",
		mp3Path,
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	data, err := cmd.Output()
	if err != nil {
		return ExistingTags{}, nil
	}

	var out ffprobeOutput
	if err := json.Unmarshal(data, &out); err != nil {
		return ExistingTags{}, nil
	}

	return ExistingTags{
		Title:  out.Format.Tags.Title,
		Artist: out.Format.Tags.Artist,
		Album:  out.Format.Tags.Album,
	}, nil
}

func buildArgsWithCover(input, cover, output string, tags Tags) []string {
	return []string{
		"-y",
		"-i", input,
		"-i", cover,
		"-map", "0:a",
		"-map", "1:v",
		"-codec:a", "copy",
		"-codec:v", "mjpeg",
		"-metadata", "title=" + tags.Title,
		"-metadata", "artist=" + tags.Artist,
		"-metadata", "album=" + tags.Album,
		"-id3v2_version", "3",
		"-write_id3v1", "1",
		output,
	}
}

func buildArgsNoCover(input, output string, tags Tags) []string {
	return []string{
		"-y",
		"-i", input,
		"-map", "0:a",
		"-codec:a", "copy",
		"-metadata", "title=" + tags.Title,
		"-metadata", "artist=" + tags.Artist,
		"-metadata", "album=" + tags.Album,
		"-id3v2_version", "3",
		"-write_id3v1", "1",
		output,
	}
}

func fetchToTemp(url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	f, err := os.CreateTemp("", "cover-*.jpg")
	if err != nil {
		return "", err
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}

func findFfprobe() string {
	// Check same dir as ffmpeg first (our bundled bin dir)
	if ffmpegPath, err := exec.LookPath("ffmpeg"); err == nil {
		candidate := filepath.Join(filepath.Dir(ffmpegPath), "ffprobe.exe")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		// Try plain ffprobe on PATH
		if p, err := exec.LookPath("ffprobe"); err == nil {
			return p
		}
	}
	return ""
}
