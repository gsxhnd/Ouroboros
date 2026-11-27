package workspace

import "testing"

func TestCreateMountReusesRemoteNode(t *testing.T) {
	store := newTaskStore(t)
	local := tempLocalDir(t)
	mountPoint := tempLocalDir(t)
	_, doc, err := store.CreateSyncTask(CreateSyncTask{
		Name:      "backup",
		Operation: OpCopy,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "drive", Path: "photos"},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	created, _, err := store.CreateMount(CreateMount{
		Revision: doc.Revision,
		Name:     "photos",
		Source:   TaskEndpoint{Kind: "remote", Remote: "drive", Path: "photos"},
		Target:   TaskEndpoint{Kind: "local", Path: mountPoint},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if created.Name != "photos" || created.Source.Remote != "drive" || created.Target.Path != mountPoint || !created.Enabled {
		t.Fatalf("unexpected mount %+v", created)
	}
	got := store.Get()
	if len(got.Nodes) != 3 {
		t.Fatalf("expected the remote node to be reused, got %d nodes", len(got.Nodes))
	}
}

func TestCreateMountValidation(t *testing.T) {
	store := newTaskStore(t)
	local := tempLocalDir(t)
	other := tempLocalDir(t)
	base := CreateMount{
		Name:   "photos",
		Source: TaskEndpoint{Kind: "remote", Remote: "drive", Path: "photos"},
		Target: TaskEndpoint{Kind: "local", Path: local},
	}
	if _, _, err := store.CreateMount(base, []string{"drive"}, true); err != nil {
		t.Fatal(err)
	}
	_, revision := store.ListMounts()
	cases := []CreateMount{
		{Revision: revision, Name: "", Source: base.Source, Target: TaskEndpoint{Kind: "local", Path: other}},
		{Revision: revision, Name: "local-source", Source: TaskEndpoint{Kind: "local", Path: other}, Target: TaskEndpoint{Kind: "local", Path: other}},
		{Revision: revision, Name: "remote-target", Source: base.Source, Target: TaskEndpoint{Kind: "remote", Remote: "drive"}},
		{Revision: revision, Name: "photos", Source: base.Source, Target: TaskEndpoint{Kind: "local", Path: other}},
		{Revision: revision, Name: "again", Source: TaskEndpoint{Kind: "remote", Remote: "other"}, Target: base.Target},
		{Revision: revision, Name: "escape", Source: TaskEndpoint{Kind: "remote", Remote: "drive", Path: "../x"}, Target: TaskEndpoint{Kind: "local", Path: other}},
	}
	for i, req := range cases {
		if _, _, err := store.CreateMount(req, []string{"drive", "other"}, true); err == nil {
			t.Fatalf("case %d should fail", i)
		}
	}
	if _, rev := store.ListMounts(); rev != revision {
		t.Fatalf("failed creates changed revision to %d", rev)
	}
}

func TestDeleteMountDropsOrphanNodes(t *testing.T) {
	store := newTaskStore(t)
	local := tempLocalDir(t)
	mountPoint := tempLocalDir(t)
	_, doc, err := store.CreateSyncTask(CreateSyncTask{
		Name:      "backup",
		Operation: OpCopy,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "drive", Path: "photos"},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	created, doc, err := store.CreateMount(CreateMount{
		Revision: doc.Revision,
		Name:     "photos",
		Source:   TaskEndpoint{Kind: "remote", Remote: "drive", Path: "photos"},
		Target:   TaskEndpoint{Kind: "local", Path: mountPoint},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.DeleteMount(created.ID, doc.Revision); err != nil {
		t.Fatal(err)
	}
	got := store.Get()
	for _, edge := range got.Edges {
		if edge.Kind == EdgeMount {
			t.Fatal("mount edge survived delete")
		}
	}
	for _, node := range got.Nodes {
		if node.Kind == NodeLocal && node.LocalPath != nil && *node.LocalPath == mountPoint {
			t.Fatal("unused mount point node was kept")
		}
	}
	if len(got.Nodes) != 2 {
		t.Fatalf("shared sync nodes should remain, got %d", len(got.Nodes))
	}
	if _, err := store.DeleteMount(created.ID, got.Revision); err == nil {
		t.Fatal("deleting a missing mount should fail")
	}
}
