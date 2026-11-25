package httpapi

import (
	"io"
	"net/http"
)

func (a *api) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, "ok")
}

func (a *api) systemInfo(w http.ResponseWriter, _ *http.Request) {
	var home *string
	if a.state.HomeDir != "" {
		value := a.state.HomeDir
		home = &value
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"name":     "ourboros",
		"version":  a.state.Version,
		"home_dir": home,
		"rclone":   a.state.Rclone.Status(),
	})
}
