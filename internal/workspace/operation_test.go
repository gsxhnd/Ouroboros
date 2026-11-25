package workspace

import (
	"testing"
)

func TestOperationSemantics(t *testing.T) {
	if OpBisync.RcloneCommand() != "sync/bisync" {
		t.Fatalf("bisync command %s", OpBisync.RcloneCommand())
	}
	if OpCopy.Destructive() {
		t.Fatal("copy should not be destructive")
	}
	for _, op := range []Operation{OpMove, OpSync, OpBisync} {
		if !op.Destructive() {
			t.Fatalf("%s should be destructive", op)
		}
	}
	if _, err := ParseOperation("bisync"); err != nil {
		t.Fatal(err)
	}
	if _, err := ParseOperation("nope"); err == nil {
		t.Fatal("unknown operation should fail")
	}
}
