package webui

import (
	"os"
	"path/filepath"

	"github.com/gsxhnd/ourboros/internal/core"
)

func Resolve(explicit string) (string, error) {
	if explicit != "" {
		return Require(explicit)
	}
	return discover(), nil
}

func Require(path string) (string, error) {
	canonical, err := filepath.Abs(path)
	if err != nil {
		return "", core.InvalidRequest("web UI directory not found: " + path + ": " + err.Error())
	}
	info, err := os.Stat(canonical)
	if err != nil || !info.IsDir() {
		if err == nil {
			err = os.ErrNotExist
		}
		return "", core.InvalidRequest("web UI directory not found: " + path + ": " + err.Error())
	}
	index := filepath.Join(canonical, "index.html")
	if info, err := os.Stat(index); err != nil || info.IsDir() {
		return "", core.InvalidRequest("web UI directory is missing index.html: " + canonical)
	}
	return canonical, nil
}

func discover() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	parent := filepath.Dir(exe)
	candidates := []string{
		filepath.Join(parent, "web"),
		filepath.Join(parent, "..", "Resources", "web"),
		filepath.Join(parent, "..", "share", "ourboros", "web"),
	}
	for _, candidate := range candidates {
		resolved, err := Require(candidate)
		if err == nil {
			return resolved
		}
	}
	return ""
}
