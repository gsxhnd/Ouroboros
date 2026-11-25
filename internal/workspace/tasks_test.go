package workspace

import (
	"testing"
)

func TestCreateSyncTaskReusesNodes(t *testing.T) {
	store := newTaskStore(t)
	local := tempLocalDir(t)
	first, _, err := store.CreateSyncTask(CreateSyncTask{
		Revision:  0,
		Name:      "backup",
		Operation: OpSync,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "archive", Path: "docs"},
		BWLimit:   "10MiB",
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if first.Destructive != true || first.BWLimit != "10MiB" {
		t.Fatalf("unexpected task %+v", first)
	}
	if first.Source.Kind != "local" || first.Target.Remote != "archive" {
		t.Fatalf("unexpected endpoints %+v", first)
	}
	_, revision := store.SyncTasks()
	if revision != 1 {
		t.Fatalf("revision %d", revision)
	}
	// 相同端点复用节点：节点数量保持 2。
	second, _, err := store.CreateSyncTask(CreateSyncTask{
		Revision:  revision,
		Name:      "mirror",
		Operation: OpBisync,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "archive", Path: "docs"},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if second.ID == first.ID {
		t.Fatal("expected new task id")
	}
	doc := store.Get()
	if len(doc.Nodes) != 2 {
		t.Fatalf("expected nodes reused, got %d", len(doc.Nodes))
	}
}

func TestCreateSyncTaskValidation(t *testing.T) {
	store := newTaskStore(t)
	local := tempLocalDir(t)
	cases := []CreateSyncTask{
		{Name: "", Operation: OpCopy, Source: TaskEndpoint{Kind: "local", Path: local}, Target: TaskEndpoint{Kind: "remote", Remote: "a"}},
		{Name: "x", Operation: "bogus", Source: TaskEndpoint{Kind: "local", Path: local}, Target: TaskEndpoint{Kind: "remote", Remote: "a"}},
		{Name: "x", Operation: OpCopy, Source: TaskEndpoint{Kind: "local", Path: local}, Target: TaskEndpoint{Kind: "remote", Remote: "a"}, BWLimit: "bogus"},
		{Name: "x", Operation: OpCopy, Source: TaskEndpoint{Kind: "local", Path: local}, Target: TaskEndpoint{Kind: "remote", Remote: "a"}, MaxTransfer: "10M:00:00"},
		{Name: "x", Operation: OpCopy, Source: TaskEndpoint{Kind: "local", Path: "relative/path"}, Target: TaskEndpoint{Kind: "remote", Remote: "a"}},
		{Name: "x", Operation: OpCopy, Source: TaskEndpoint{Kind: "remote", Remote: "missing", Path: ""}, Target: TaskEndpoint{Kind: "remote", Remote: "a"}},
	}
	for i, req := range cases {
		if _, _, err := store.CreateSyncTask(req, []string{"a"}, true); err == nil {
			t.Fatalf("case %d should fail", i)
		}
	}
	// 相同名称冲突
	_, revision := store.SyncTasks()
	_, _, err := store.CreateSyncTask(CreateSyncTask{
		Revision:  revision,
		Name:      "backup",
		Operation: OpCopy,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "archive", Path: "docs"},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := store.CreateSyncTask(CreateSyncTask{
		Revision:  revision + 1,
		Name:      "backup",
		Operation: OpCopy,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "archive", Path: "other"},
	}, nil, false); err == nil {
		t.Fatal("expected duplicate name conflict")
	}
}

func TestPatchAndDeleteSyncTask(t *testing.T) {
	store := newTaskStore(t)
	local := tempLocalDir(t)
	other := tempLocalDir(t)
	task, _, err := store.CreateSyncTask(CreateSyncTask{
		Revision:  0,
		Name:      "backup",
		Operation: OpCopy,
		Source:    TaskEndpoint{Kind: "local", Path: local},
		Target:    TaskEndpoint{Kind: "remote", Remote: "archive", Path: "docs"},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	_, revision := store.SyncTasks()
	updated, _, err := store.PatchSyncTask(task.ID, PatchSyncTask{
		Revision:    revision,
		Operation:   ptrOperation(OpSync),
		BWLimit:     ptrString("5M"),
		MaxTransfer: ptrString("1GiB"),
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Operation != OpSync || updated.BWLimit != "5M" || updated.MaxTransfer != "1GiB" {
		t.Fatalf("unexpected patch result %+v", updated)
	}
	if !updated.Destructive {
		t.Fatal("sync operation should be destructive")
	}

	// 更换端点后旧节点被清理。
	_, revision = store.SyncTasks()
	patched, _, err := store.PatchSyncTask(task.ID, PatchSyncTask{
		Revision: revision,
		Source:   ptrEndpoint(TaskEndpoint{Kind: "local", Path: other}),
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if patched.Source.Path != other {
		t.Fatalf("unexpected source %+v", patched.Source)
	}
	doc := store.Get()
	if len(doc.Nodes) != 2 {
		t.Fatalf("expected orphan node removed, got %d", len(doc.Nodes))
	}

	// 删除任务同样清理节点。
	_, revision = store.SyncTasks()
	if _, err := store.DeleteSyncTask(task.ID, revision); err != nil {
		t.Fatal(err)
	}
	doc = store.Get()
	if len(doc.Edges) != 0 || len(doc.Nodes) != 0 {
		t.Fatalf("expected empty document, got %d edges %d nodes", len(doc.Edges), len(doc.Nodes))
	}
	if _, err := store.DeleteSyncTask(task.ID, store.Get().Revision); err == nil {
		t.Fatal("expected deleting missing task to fail")
	}
}
