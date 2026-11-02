package persist

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"

	"github.com/gsxhnd/ourboros/internal/core"
)

func AtomicWrite(path string, data []byte) error {
	parent := filepath.Dir(path)
	if parent == "" || parent == "." {
		return core.InvalidPath("path has no parent: " + path)
	}
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return core.IO(err)
	}
	tmp, err := os.CreateTemp(parent, "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return core.IO(err)
	}
	tmpName := tmp.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpName)
		}
	}()
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return core.IO(err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return core.IO(err)
	}
	if err := tmp.Close(); err != nil {
		return core.IO(err)
	}
	if runtime.GOOS == "windows" {
		if _, err := os.Stat(path); err == nil {
			if err := os.Remove(path); err != nil {
				return core.IO(err)
			}
		}
	}
	if err := os.Rename(tmpName, path); err != nil {
		return core.IO(err)
	}
	cleanup = false
	return nil
}

func AtomicWriteJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return core.CorruptStore("failed to serialize " + path + ": " + err.Error())
	}
	data = append(data, '\n')
	return AtomicWrite(path, data)
}

func ReadJSONBytes(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, core.IO(err)
	}
	return data, nil
}

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
