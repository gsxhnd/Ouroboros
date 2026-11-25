package workspace

import (
	"github.com/gsxhnd/ourboros/internal/core"
)

type Operation string

const (
	OpCopy   Operation = "copy"
	OpMove   Operation = "move"
	OpSync   Operation = "sync"
	OpBisync Operation = "bisync"
)

func (o Operation) RcloneCommand() string {
	switch o {
	case OpMove:
		return "sync/move"
	case OpSync:
		return "sync/sync"
	case OpBisync:
		return "sync/bisync"
	default:
		return "sync/copy"
	}
}

func (o Operation) Destructive() bool {
	return o != OpCopy
}

func (o Operation) TwoWay() bool {
	return o == OpBisync
}

func (o Operation) Impact(source, target string) string {
	switch o {
	case OpMove:
		return "Move files from " + source + " to " + target + ". Files will be removed from the source."
	case OpSync:
		return "Sync " + source + " to " + target + ". Extra files on the destination may be deleted."
	case OpBisync:
		return "Two-way sync between " + source + " and " + target + ". Changes including deletions propagate in BOTH directions."
	default:
		return "Copy files from " + source + " to " + target + ". Source is unchanged."
	}
}

func ParseOperation(value string) (Operation, error) {
	switch Operation(value) {
	case OpCopy, OpMove, OpSync, OpBisync:
		return Operation(value), nil
	default:
		return "", core.InvalidRequest("operation must be one of copy, move, sync or bisync")
	}
}
