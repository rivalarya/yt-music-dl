package metadata

import (
	"fmt"
	"io"
	"net/http"

	"github.com/bogem/id3v2/v2"
)

type Tags struct {
	Title    string
	Artist   string
	Album    string
	CoverURL string
}

func Tag(mp3Path string, tags Tags) error {
	tag, err := id3v2.Open(mp3Path, id3v2.Options{Parse: true})
	fmt.Println(tags)
	if err != nil {
		return fmt.Errorf("open mp3: %w", err)
	}
	defer tag.Close()

	tag.SetTitle(tags.Title)
	tag.SetArtist(tags.Artist)
	tag.SetAlbum(tags.Album)

	return tag.Save()
}

func fetchBytes(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}