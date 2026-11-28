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

// limitOffset 解析执行历史的分页参数：limit 默认 50、上限 200；offset 默认 0。
func limitOffset(r *http.Request) (int, int, error) {
	limit, offset := 50, 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			return 0, 0, core.InvalidRequest("limit must be a positive integer")
		}
		limit = min(parsed, 200)
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			return 0, 0, core.InvalidRequest("offset must be a non-negative integer")
		}
		offset = parsed
	}
	return limit, offset, nil
}
