package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/gsxhnd/ourboros/internal/core"
)

func (a *api) proxyRC(w http.ResponseWriter, r *http.Request) {
	command := r.PathValue("command")
	payload := map[string]any{}
	if err := checkBodySize(r); err != nil {
		writeError(w, err)
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(nil, r.Body, maxJSONBytes))
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeError(w, core.InvalidRequest("request body too large"))
			return
		}
		writeError(w, core.IO(err))
		return
	}
	if len(bytes.TrimSpace(raw)) > 0 {
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		if err := dec.Decode(&payload); err != nil {
			writeError(w, core.InvalidRequest(err.Error()))
			return
		}
	}
	response, err := a.svc.RC.Call(r.Context(), command, payload)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, response.Status, response.Body)
}
