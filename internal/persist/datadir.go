package persist

import (
	"os"
	"path/filepath"
	"runtime"
)

func DefaultDataDir() string {
	if raw := os.Getenv("OURBOROS_DATA_DIR"); raw != "" {
		return raw
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(".", "ourboros-data")
	}
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Ourboros")
	case "windows":
		base, err := os.UserConfigDir()
		if err != nil || base == "" {
			base = home
		}
		return filepath.Join(base, "Ourboros", "Ourboros", "data")
	default:
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return filepath.Join(xdg, "ourboros")
		}
		return filepath.Join(home, ".local", "share", "ourboros")
	}
}
