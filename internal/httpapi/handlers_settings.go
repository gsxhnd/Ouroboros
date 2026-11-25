package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/settings"
)

func (a *api) settingsGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.state.Settings.Get())
}

func (a *api) settingsPatch(w http.ResponseWriter, r *http.Request) {
	var body settings.Patch
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if err := a.state.CheckSettingsPatch(body); err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Settings.Patch(body)
	if err != nil {
		writeError(w, err)
		return
	}
	if len(body.Shortcuts) > 0 {
		a.state.Events.Publish(events.NameSettings, doc)
	}
	a.state.ApplySettings(doc)
	writeJSON(w, http.StatusOK, doc)
}
