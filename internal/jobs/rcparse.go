package jobs

import (
	"encoding/json"
)

func parseStats(body map[string]any) Progress {
	progress := Progress{
		Bytes:     asUint(body["bytes"]),
		Transfers: asUint(body["transfers"]),
		Checks:    asUint(body["checks"]),
		Errors:    asUint(body["errors"]),
		Speed:     asFloat(body["speed"]),
	}
	if items, ok := body["transferring"].([]any); ok && len(items) > 0 {
		if item, ok := items[0].(map[string]any); ok {
			progress.Percentage = asFloat(item["percentage"])
		}
	}
	if eta, ok := asFloatPtr(body["eta"]); ok {
		progress.ETASeconds = &eta
	}
	return progress
}

func mergeProgress(progress *Progress, value map[string]any) {
	if _, ok := value["bytes"]; ok {
		progress.Bytes = asUint(value["bytes"])
	}
	if _, ok := value["percentage"]; ok {
		progress.Percentage = asFloat(value["percentage"])
	}
	if _, ok := value["speed"]; ok {
		progress.Speed = asFloat(value["speed"])
	}
	if eta, ok := asFloatPtr(value["eta"]); ok {
		progress.ETASeconds = &eta
	}
}

func asUint(value any) uint64 {
	switch typed := value.(type) {
	case json.Number:
		n, _ := typed.Int64()
		if n < 0 {
			return 0
		}
		return uint64(n)
	case float64:
		if typed < 0 {
			return 0
		}
		return uint64(typed)
	default:
		return 0
	}
}

func asFloat(value any) float64 {
	number, _ := asFloatPtr(value)
	return number
}

func asFloatPtr(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case float64:
		return typed, true
	default:
		return 0, false
	}
}

func asInt64(value any) (int64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Int64()
		return number, err == nil
	case float64:
		return int64(typed), true
	default:
		return 0, false
	}
}
