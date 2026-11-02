package jobs

import (
	"context"
	"testing"

	"github.com/gsxhnd/ourboros/internal/events"
)

// A poller that notices a job finished after it was cancelled must not
// overwrite the cancelled status, nor release the edge lock that a newer job
// on the same edge now holds.
func TestFinishIsIdempotentAndKeepsNewerEdgeLock(t *testing.T) {
	store := New(context.Background(), events.New())
	const edge = "edge-1"

	store.jobs["old"] = &record{snapshot: Snapshot{ID: "old", EdgeID: edge, Status: StatusRunning}}
	store.runningEdges[edge] = struct{}{}
	if _, err := store.finish("old", edge, StatusCancelled, nil, nil); err != nil {
		t.Fatalf("cancel old job: %v", err)
	}

	// A new job starts on the same edge once the old one is cancelled.
	store.jobs["new"] = &record{snapshot: Snapshot{ID: "new", EdgeID: edge, Status: StatusRunning}}
	store.runningEdges[edge] = struct{}{}

	// The old job's poller reports success late.
	snapshot, err := store.finish("old", edge, StatusSucceeded, nil, nil)
	if err != nil {
		t.Fatalf("late finish: %v", err)
	}
	if snapshot.Status != StatusCancelled {
		t.Fatalf("status overwritten: got %q, want %q", snapshot.Status, StatusCancelled)
	}
	if !store.IsRunning(edge) {
		t.Fatal("late finish of old job released the lock held by the new job")
	}
}
