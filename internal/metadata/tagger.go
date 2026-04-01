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
	if err != nil {
		return fmt.Errorf("open mp3: %w", err)
	}
	defer tag.Close()

	tag.SetTitle(tags.Title)
	tag.SetArtist(tags.Artist)
	tag.SetAlbum(tags.Album)

	if tags.CoverURL != "" {
		cover, err := fetchBytes(tags.CoverURL)
		if err == nil {
			tag.AddAttachedPicture(id3v2.PictureFrame{
				Encoding:    id3v2.EncodingUTF8,
				MimeType:    "image/jpeg",
				PictureType: id3v2.PTFrontCover,
				Picture:     cover,
			})
		}
	}

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