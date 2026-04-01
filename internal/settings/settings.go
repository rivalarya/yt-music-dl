package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Settings struct {
	AutoSelectFirst bool   `json:"autoSelectFirst"`
	OutputDir       string `json:"outputDir"`
	CookiePath      string `json:"cookiePath"`
}

func configPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(exe), "settings.json"), nil
}

func Load() (Settings, error) {
	path, err := configPath()
	if err != nil {
		return defaultSettings(), err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		// First run — return defaults
		return defaultSettings(), nil
	}

	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		return defaultSettings(), err
	}
	return s, nil
}

func Save(s Settings) error {
	path, err := configPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func defaultSettings() Settings {
	home, _ := os.UserHomeDir()
	return Settings{
		AutoSelectFirst: false,
		OutputDir:       filepath.Join(home, "Music"),
		CookiePath:      "",
	}
}