package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

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

// decodeJSONOptional 与 decodeJSON 相同，但空请求体不会报错，目标保持零值。
// 适用于全部字段可选的端点（例如运行同步任务）。
func decodeJSONOptional(r *http.Request, dst any) error {
	if err := checkBodySize(r); err != nil {
		return err
	}
	r.Body = http.MaxBytesReader(nil, r.Body, maxJSONBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return core.InvalidRequest("request body too large")
		}
		return core.IO(err)
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	if err := dec.Decode(dst); err != nil {
		return core.InvalidRequest(err.Error())
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return core.InvalidRequest("unexpected trailing content after JSON body")
	}
	return nil
}
