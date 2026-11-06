package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

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
	details := map[string]any{}
	if err.Details != nil {
		for key, value := range err.Details {
			details[key] = value
		}
	}
	if err.Kind == core.KindConflict && err.Detail("kind") == "workspace_revision" {
		code = "workspace_conflict"
		details = map[string]any{
			"message":  err.Message,
			"expected": err.Detail("expected"),
			"found":    err.Detail("found"),
		}
	} else if err.Kind == core.KindConflict {
		details["message"] = err.Message
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

// maxJSONBytes caps every JSON request body (including the RC proxy payload)
// so a hostile page on the loopback cannot stream unbounded data into the
// server's memory.
const maxJSONBytes = 1 << 20 // 1 MiB

func checkBodySize(r *http.Request) error {
	if header := r.Header.Get("Content-Length"); header != "" {
		if n, err := strconv.Atoi(header); err == nil && n > maxJSONBytes {
			return core.InvalidRequest("request body too large")
		}
	}
	return nil
}

func decodeJSON(r *http.Request, dst any) error {
	if err := checkBodySize(r); err != nil {
		return err
	}
	r.Body = http.MaxBytesReader(nil, r.Body, maxJSONBytes)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return core.InvalidRequest("request body too large")
		}
		return core.InvalidRequest(err.Error())
	}
	// Reject trailing content so typo'd concatenation cannot be silently
	// ignored by callers that re-derive meaning from the first value only.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return core.InvalidRequest("unexpected trailing content after JSON body")
	}
	return nil
}
