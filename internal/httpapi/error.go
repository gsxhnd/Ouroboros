package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(value)
}

func writeError(w http.ResponseWriter, err error) {
	var coreErr *core.Error
	if errors.As(err, &coreErr) {
		status, code, details := mapCore(coreErr)
		writeAPIError(w, status, code, coreErr.Error(), details)
		return
	}
	writeAPIError(w, http.StatusInternalServerError, "internal", err.Error(), map[string]any{})
}

func writeAPIError(w http.ResponseWriter, status int, code, message string, details any) {
	if details == nil {
		details = map[string]any{}
	}
	writeJSON(w, status, errorBody{Error: errorDetail{Code: code, Message: message, Details: details}})
}

func mapCore(err *core.Error) (int, string, any) {
	code := err.Code()
	details := any(map[string]any{})
	if err.Kind == core.KindConflict && strings.Contains(err.Message, "revision") {
		code = "workspace_conflict"
	}
	if err.Kind == core.KindConflict && strings.Contains(err.Message, "found") {
		details = map[string]any{"message": err.Message}
	}
	switch err.Kind {
	case core.KindInvalidCommand, core.KindForbiddenCommand, core.KindInvalidPath, core.KindInvalidRequest:
		return http.StatusBadRequest, code, details
	case core.KindNotFound:
		return http.StatusNotFound, code, details
	case core.KindAlreadyRunning, core.KindConflict:
		return http.StatusConflict, code, details
	case core.KindNotRunning, core.KindReadyTimeout, core.KindBinaryNotFound:
		return http.StatusServiceUnavailable, code, details
	case core.KindTransport:
		return http.StatusBadGateway, code, details
	default:
		return http.StatusInternalServerError, code, details
	}
}

func badRequest(w http.ResponseWriter, message string) {
	writeAPIError(w, http.StatusBadRequest, "invalid_request", message, map[string]any{})
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		return core.InvalidRequest(err.Error())
	}
	return nil
}
