package workspace

import (
	"testing"
	"time"
)

func TestValidateRejectsIllegalMountDirection(t *testing.T) {
	doc := Document{
		SchemaVersion: 1,
		Nodes: []Node{
			localNode("local", "/tmp/ourboros-local"),
			remoteNode("remote", "archive"),
		},
		Edges: []Edge{{
			ID: "e1", Source: "local", Target: "remote", Kind: EdgeMount,
		}},
		UpdatedAt: time.Now().UTC(),
	}
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected illegal mount to fail")
	}
}

func TestValidateRejectsOrphanAndDuplicateEdges(t *testing.T) {
	doc := Document{
		SchemaVersion: 1,
		Nodes: []Node{
			localNode("local", "/tmp/ourboros-local"),
			remoteNode("remote", "archive"),
		},
		Edges: []Edge{{
			ID: "e1", Source: "missing", Target: "local", Kind: EdgeSync,
			Sync: ptrSync(DefaultSync(OpCopy)),
		}},
		UpdatedAt: time.Now().UTC(),
	}
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected orphan edge to fail")
	}
	doc.Edges[0].Source = "remote"
	if err := Validate(&doc, nil, false, ""); err != nil {
		t.Fatal(err)
	}
	// 同端点对的多条同步规则合法（例如复制 + 双向同步）。
	doc.Edges = append(doc.Edges, Edge{
		ID: "e2", Source: "remote", Target: "local", Kind: EdgeSync,
		Sync: ptrSync(DefaultSync(OpBisync)),
	})
	if err := Validate(&doc, nil, false, ""); err != nil {
		t.Fatal(err)
	}
	// 重复挂载同一端点对仍然拒绝。
	doc.Edges = append(doc.Edges,
		Edge{ID: "e3", Source: "remote", Target: "local", Kind: EdgeMount},
		Edge{ID: "e4", Source: "remote", Target: "local", Kind: EdgeMount},
	)
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected duplicate mount to fail")
	}
}

func TestValidateRejectsUnknownEdgeKind(t *testing.T) {
	doc := Document{
		SchemaVersion: 1,
		Nodes: []Node{
			localNode("local", "/tmp/ourboros-local"),
			remoteNode("remote", "archive"),
		},
		Edges: []Edge{{
			ID: "e1", Source: "local", Target: "remote", Kind: "flow",
		}},
		UpdatedAt: time.Now().UTC(),
	}
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected unknown edge kind to fail")
	}
}

func TestValidateSyncLimits(t *testing.T) {
	base := func(limit, maxTransfer string) Document {
		return Document{
			SchemaVersion: 1,
			Nodes: []Node{
				localNode("local", "/tmp/ourboros-local"),
				remoteNode("remote", "archive"),
			},
			Edges: []Edge{{
				ID: "e1", Source: "local", Target: "remote", Kind: EdgeSync,
				Sync: ptrSync(func() SyncConfig {
					config := DefaultSync(OpCopy)
					config.BWLimit = limit
					config.MaxTransfer = maxTransfer
					return config
				}()),
			}},
			UpdatedAt: time.Now().UTC(),
		}
	}
	for _, value := range []string{"10MiB", "1.5M", "100", "off", ""} {
		if err := Validate(ptrDoc(base(value, "")), nil, false, ""); err != nil {
			t.Fatalf("bw_limit %q: %v", value, err)
		}
	}
	for _, value := range []string{"10M:00:00", "abc", "-1G", "5X"} {
		if err := Validate(ptrDoc(base(value, "")), nil, false, ""); err == nil {
			t.Fatalf("bw_limit %q should fail", value)
		}
	}
	if err := Validate(ptrDoc(base("", "1GiB")), nil, false, ""); err != nil {
		t.Fatal(err)
	}
	if err := Validate(ptrDoc(base("", "off")), nil, false, ""); err != nil {
		t.Fatal(err)
	}
	if err := Validate(ptrDoc(base("", "1M:00:00")), nil, false, ""); err == nil {
		t.Fatal("max_transfer timetable should fail")
	}
}
