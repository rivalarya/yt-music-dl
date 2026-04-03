package deezer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"yt-music-dl/internal/logger"
)

type Track struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	CoverURL string `json:"coverUrl"`
	Duration int    `json:"duration"`
}

type deezerTrack struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Artist struct {
		Name string `json:"name"`
	} `json:"artist"`
	Album struct {
		Title string `json:"title"`
		Cover string `json:"cover_medium"`
	} `json:"album"`
	Duration int `json:"duration"`
}

type deezerResponse struct {
	Data []deezerTrack `json:"data"`
}

func Search(query string) ([]Track, error) {
	endpoint := fmt.Sprintf("https://api.deezer.com/search?q=%s", url.QueryEscape(query))
	logger.Log.WithField("endpoint", endpoint).Debug("deezer request")

	resp, err := http.Get(endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result deezerResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	logger.Log.WithField("count", len(result.Data)).Debug("deezer results")

	tracks := make([]Track, 0, len(result.Data))
	for _, t := range result.Data {
		tracks = append(tracks, Track{
			ID:       t.ID,
			Title:    t.Title,
			Artist:   t.Artist.Name,
			Album:    t.Album.Title,
			CoverURL: t.Album.Cover,
			Duration: t.Duration,
		})
	}
	return tracks, nil
}
