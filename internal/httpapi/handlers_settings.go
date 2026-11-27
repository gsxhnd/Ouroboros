package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/settings"
)

func (a *api) settingsGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.svc.Settings.Get())
}

func (a *api) settingsPatch(w http.ResponseWriter, r *http.Request) {
	var body settings.Patch
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.svc.Settings.Patch(body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}
