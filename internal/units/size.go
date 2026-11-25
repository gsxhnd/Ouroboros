// Package units parses the size strings rclone accepts for bandwidth and
// transfer limits.
package units

import (
	"math"
	"strconv"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

// ParseSize 解析 rclone 风格的容量字符串，例如 "100"、"10M"、"1.5GiB"。
// 仅支持单个大小值，不支持带宽时间表（"10M:00:00"）这类复杂格式。
func ParseSize(value string) (int64, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, core.InvalidPath("size value is empty")
	}
	i := 0
	for i < len(trimmed) && (trimmed[i] >= '0' && trimmed[i] <= '9' || trimmed[i] == '.') {
		i++
	}
	number := trimmed[:i]
	unit := strings.ToLower(strings.TrimSpace(trimmed[i:]))
	if number == "" {
		return 0, core.InvalidPath("size must start with a number: " + value)
	}
	multiplier := 1.0
	switch unit {
	case "", "b":
		multiplier = 1
	case "k", "kb", "kib":
		multiplier = 1 << 10
	case "m", "mb", "mib":
		multiplier = 1 << 20
	case "g", "gb", "gib":
		multiplier = 1 << 30
	case "t", "tb", "tib":
		multiplier = 1 << 40
	case "p", "pb", "pib":
		multiplier = 1 << 50
	default:
		return 0, core.InvalidRequest("size unit must be B, K, M, G, T or P (optionally iB): " + value)
	}
	parsed, err := strconv.ParseFloat(number, 64)
	if err != nil || parsed < 0 {
		return 0, core.InvalidRequest("invalid size value: " + value)
	}
	bytes := parsed * multiplier
	if bytes > math.MaxInt64 {
		return 0, core.InvalidRequest("size value is too large: " + value)
	}
	return int64(bytes), nil
}

// IsOff reports whether a limit value means "no limit": empty or "off".
func IsOff(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed == "" || strings.EqualFold(trimmed, "off")
}

// ValidateLimit checks a bandwidth or transfer limit: empty or "off" means
// unlimited, anything else must be a single size value. Time-table forms such
// as "10M:00:00" are rejected on purpose, because rclone's bandwidth limiter
// is process-wide and a schedule would apply to every running task.
func ValidateLimit(value string) error {
	if IsOff(value) {
		return nil
	}
	_, err := ParseSize(value)
	return err
}
