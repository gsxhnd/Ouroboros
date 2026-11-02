package rclone

import (
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

var proxyAllowlist = map[string]struct{}{
	"core/version":          {},
	"core/stats":            {},
	"config/listremotes":    {},
	"operations/list":       {},
	"operations/mkdir":      {},
	"operations/deletefile": {},
	"operations/purge":      {},
}

var sensitiveCommands = map[string]struct{}{
	"config/dump":      {},
	"config/get":       {},
	"config/password":  {},
	"config/providers": {},
	"options/get":      {},
	"core/pid":         {},
	"core/command":     {},
}

func JoinRCURL(base, command string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(command, "/")
}

func ValidateCommand(command string) error {
	if command == "" {
		return core.InvalidCommand(command)
	}
	for _, ch := range command {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '/' || ch == '_' || ch == '-' {
			continue
		}
		return core.InvalidCommand(command)
	}
	return nil
}

func isSensitiveCommand(command string) bool {
	lower := strings.ToLower(command)
	if _, ok := sensitiveCommands[lower]; ok {
		return true
	}
	return strings.Contains(lower, "dump") || strings.Contains(lower, "password")
}

func ValidateProxyCommand(command string) error {
	if err := ValidateCommand(command); err != nil {
		return err
	}
	if isSensitiveCommand(command) {
		return core.ForbiddenCommand(command)
	}
	if _, ok := proxyAllowlist[command]; !ok {
		return core.ForbiddenCommand(command)
	}
	return nil
}

func redactSecrets(input string, secrets ...string) string {
	redacted := input
	for _, secret := range secrets {
		if len(secret) >= 4 {
			redacted = strings.ReplaceAll(redacted, secret, "***")
		}
	}
	return redacted
}
