package core

import "fmt"

type Kind int

const (
	KindNotRunning Kind = iota
	KindAlreadyRunning
	KindBinaryNotFound
	KindReadyTimeout
	KindInvalidCommand
	KindForbiddenCommand
	KindTransport
	KindInvalidPath
	KindInvalidRequest
	KindNotFound
	KindConflict
	KindIO
	KindUnsupportedSchema
	KindCorruptStore
)

type Error struct {
	Kind     Kind
	Message  string
	Document string
	Version  uint32
	Err      error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.Err }

func (e *Error) Code() string {
	switch e.Kind {
	case KindNotRunning, KindReadyTimeout, KindBinaryNotFound:
		return "rclone_unavailable"
	case KindAlreadyRunning:
		return "already_running"
	case KindInvalidCommand:
		return "invalid_command"
	case KindForbiddenCommand:
		return "forbidden_command"
	case KindTransport:
		return "rclone_error"
	case KindInvalidPath:
		return "invalid_path"
	case KindInvalidRequest:
		return "invalid_request"
	case KindNotFound:
		return "not_found"
	case KindConflict:
		return "conflict"
	case KindIO:
		return "io_error"
	case KindUnsupportedSchema:
		return "unsupported_schema"
	case KindCorruptStore:
		return "corrupt_store"
	default:
		return "internal"
	}
}

func NotRunning() *Error {
	return &Error{Kind: KindNotRunning, Message: "rclone is not running"}
}

func AlreadyRunning() *Error {
	return &Error{Kind: KindAlreadyRunning, Message: "rclone is already running"}
}

func BinaryNotFound(path string) *Error {
	return &Error{Kind: KindBinaryNotFound, Message: "rclone binary not found: " + path}
}

func ReadyTimeout() *Error {
	return &Error{Kind: KindReadyTimeout, Message: "rclone did not become ready in time"}
}

func InvalidCommand(command string) *Error {
	return &Error{Kind: KindInvalidCommand, Message: "invalid rclone rc command: " + command}
}

func ForbiddenCommand(command string) *Error {
	return &Error{Kind: KindForbiddenCommand, Message: "rclone rc command is not allowed: " + command}
}

func Transport(message string) *Error {
	return &Error{Kind: KindTransport, Message: "failed to contact rclone: " + message}
}

func InvalidPath(message string) *Error {
	return &Error{Kind: KindInvalidPath, Message: "invalid path: " + message}
}

func InvalidRequest(message string) *Error {
	return &Error{Kind: KindInvalidRequest, Message: "invalid request: " + message}
}

func NotFound(message string) *Error {
	return &Error{Kind: KindNotFound, Message: "not found: " + message}
}

func Conflict(message string) *Error {
	return &Error{Kind: KindConflict, Message: message}
}

func IO(err error) *Error {
	return &Error{Kind: KindIO, Message: "io error: " + err.Error(), Err: err}
}

func UnsupportedSchema(document string, version uint32) *Error {
	return &Error{
		Kind:     KindUnsupportedSchema,
		Document: document,
		Version:  version,
		Message:  fmt.Sprintf("unsupported schema version %d for %s", version, document),
	}
}

func CorruptStore(message string) *Error {
	return &Error{Kind: KindCorruptStore, Message: "store is corrupt: " + message}
}
