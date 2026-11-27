package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gsxhnd/ourboros/internal/core"
)

func revisionQuery(r *http.Request) (uint64, error) {
	raw := r.URL.Query().Get("revision")
	if raw == "" {
		return 0, core.InvalidRequest("revision is required")
	}
	value, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, core.InvalidRequest("revision is invalid")
	}
	return value, nil
}
