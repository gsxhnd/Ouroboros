package httpapi

import (
	"io"
	"mime"
	"net/http"
	"strconv"

	"github.com/gsxhnd/ourboros/internal/service"
)

func (a *api) filesList(w http.ResponseWriter, r *http.Request) {
	files, err := a.svc.Files.List(r.Context(), fileQuery(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, files)
}

func (a *api) filesMkdir(w http.ResponseWriter, r *http.Request) {
	var body service.FileBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	result, err := a.svc.Files.Mkdir(r.Context(), body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *api) filesCopy(w http.ResponseWriter, r *http.Request) {
	a.transfer(w, r, false)
}

func (a *api) filesMove(w http.ResponseWriter, r *http.Request) {
	a.transfer(w, r, true)
}

// filesDownload validates and opens the stream through the service, then
// handles HTTP-specific headers and streaming without buffering it in memory.
func (a *api) filesDownload(w http.ResponseWriter, r *http.Request) {
	stream, err := a.svc.Files.OpenDownload(r.Context(), fileQuery(r))
	if err != nil {
		writeError(w, err)
		return
	}
	defer stream.Body.Close()
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": stream.Name})
	if disposition != "" {
		w.Header().Set("Content-Disposition", disposition)
	}
	if stream.ContentType != "" {
		w.Header().Set("Content-Type", stream.ContentType)
	}
	if stream.Size >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(stream.Size, 10))
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, stream.Body)
}

func (a *api) filesDelete(w http.ResponseWriter, r *http.Request) {
	purge := r.URL.Query().Get("purge") == "true"
	result, err := a.svc.Files.Delete(r.Context(), fileQuery(r), purge)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *api) transfer(w http.ResponseWriter, r *http.Request, move bool) {
	var body service.TransferBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	var result service.TransferResult
	var err error
	if move {
		result, err = a.svc.Files.Move(r.Context(), body)
	} else {
		result, err = a.svc.Files.Copy(r.Context(), body)
	}
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func fileQuery(r *http.Request) service.FileQuery {
	query := r.URL.Query()
	return service.FileQuery{
		FS:     query.Get("fs"),
		Remote: queryPtr(query, "remote"),
		Path:   queryPtr(query, "path"),
	}
}

func queryPtr(query interface {
	Has(string) bool
	Get(string) string
}, key string) *string {
	if !query.Has(key) {
		return nil
	}
	value := query.Get(key)
	return &value
}
