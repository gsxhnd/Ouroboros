package rclone

import (
	"strings"
)

func redactAuth(message string, auth *Auth) string {
	if auth == nil {
		return message
	}
	return redactSecrets(message, auth.User, auth.Pass)
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
