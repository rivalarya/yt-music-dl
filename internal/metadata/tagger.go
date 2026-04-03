package metadata

import (
	"fmt"
	"io"
	"net/http"
	"yt-music-dl/internal/logger"

	"github.com/bogem/id3v2/v2"
)

type Tags struct {
	Title    string
	Artist   string
	Album    string
	CoverURL string
}

func Tag(mp3Path string, tags Tags) error {
	logger.Log.WithFields(map[string]interface{}{
		"path":   mp3Path,
		"title":  tags.Title,
		"artist": tags.Artist,
		"album":  tags.Album,
	}).Info("writing id3 tags")

	tag, err := id3v2.Open(mp3Path, id3v2.Options{Parse: true})
	if err != nil {
		return fmt.Errorf("open mp3: %w", err)
	}
	defer tag.Close()

	tag.SetTitle(tags.Title)
	tag.SetArtist(tags.Artist)
	tag.SetAlbum(tags.Album)

	if err := tag.Save(); err != nil {
		logger.Log.WithError(err).Error("failed to save id3 tags")
		return err
	}
	logger.Log.Info("id3 tags saved")
	return nil
}

func fetchBytes(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
