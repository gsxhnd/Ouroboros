package mounts

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// writeScript 落一个可执行的 sh 脚本，作为“rclone”替身供 SpawnMount 启动。
func writeScript(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fake-rclone")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body+"\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func remoteLocator() paths.Locator {
	return paths.Locator{Kind: paths.KindRemote, FS: "testsuite"}
}

// workspaceWithMountEdge 建一个带 mount 边（remote → local）的工作区。
func workspaceWithMountEdge(t *testing.T, localTarget string) *workspace.Store {
	t.Helper()
	if err := os.MkdirAll(localTarget, 0o755); err != nil {
		t.Fatal(err)
	}
	ws, err := workspace.LoadOrCreate(filepath.Join(t.TempDir(), "workspace.json"), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, err = ws.Replace(workspace.PutRequest{
		Nodes: []workspace.Node{
			{ID: "src", Kind: workspace.NodeRemote, Label: "src", Remote: &workspace.Remote{Name: "testsuite"}},
			{ID: "dst", Kind: workspace.NodeLocal, Label: "dst", LocalPath: &localTarget},
		},
		Edges: []workspace.Edge{
			{ID: "m1", Source: "src", Target: "dst", Kind: workspace.EdgeMount, Mount: &workspace.MountConfig{Enabled: true}},
		},
	}, []string{"testsuite"}, true)
	if err != nil {
		t.Fatal(err)
	}
	return ws
}

// 挂起的进程在宽限窗内就退出的，应当快速判失败并带出 stderr。
func TestWaitRunningDetectsFastExit(t *testing.T) {
	spawned, err := rclone.SpawnMount(
		rclone.Settings{Bin: writeScript(t, "echo faux error >&2\nexit 3")},
		remoteLocator(), t.TempDir(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if waitRunning(spawned, 2*time.Second, 25*time.Millisecond) {
		t.Fatal("expected the exiting process to be detected")
	}
	if code := spawned.ExitCode(); code == nil || *code != 3 {
		t.Fatalf("exit code %v", code)
	}
}

// 一直存活的进程应等满宽限窗后判定为仍然运行。
func TestWaitRunningKeepsAliveProcess(t *testing.T) {
	spawned, err := rclone.SpawnMount(
		rclone.Settings{Bin: writeScript(t, "exec sleep 30")},
		remoteLocator(), t.TempDir(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer spawned.Stop()
	if !waitRunning(spawned, 200*time.Millisecond, 25*time.Millisecond) {
		t.Fatal("expected the sleeping process to be considered running")
	}
}

// Start 在替身进程秒退时应当失败并暴露 stderr ……（此为行为锁）
func TestStartReportsFailedSpawn(t *testing.T) {
	target := filepath.Join(t.TempDir(), "mnt")
	ws := workspaceWithMountEdge(t, target)
	store := New(events.New())
	rc := rclone.NewSupervisor(rclone.Settings{Bin: writeScript(t, "echo faux mount failure >&2\nexit 9")})

	snapshot, err := store.Start(rc, ws, "m1")
	if err != nil {
		t.Fatalf("failed spawn should surface as snapshot, got error %v", err)
	}
	if snapshot.Status != StatusFailed {
		t.Fatalf("status %q", snapshot.Status)
	}
	if snapshot.Error == nil || !strings.Contains(*snapshot.Error, "faux mount failure") {
		t.Fatalf("stderr not surfaced: %v", snapshot.Error)
	}
}

// ……而存活的替身进程会进入 mounted；并发调用 Start 冲突，Stop 后回到 stopped。
func TestStartStopLifecycle(t *testing.T) {
	target := filepath.Join(t.TempDir(), "mnt")
	ws := workspaceWithMountEdge(t, target)
	store := New(events.New())
	rc := rclone.NewSupervisor(rclone.Settings{Bin: writeScript(t, "exec sleep 30")})

	snapshot, err := store.Start(rc, ws, "m1")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Status != StatusMounted {
		t.Fatalf("status %q", snapshot.Status)
	}
	if !store.IsActive("m1") {
		t.Fatal("mounted edge must be active")
	}
	if _, err := store.Start(rc, ws, "m1"); err == nil {
		t.Fatal("second start on a mounted edge must conflict")
	}

	stopped, err := store.Stop("m1")
	if err != nil {
		t.Fatal(err)
	}
	if stopped.Status != StatusStopped {
		t.Fatalf("status %q", stopped.Status)
	}
	if store.IsActive("m1") {
		t.Fatal("stopped edge must not be active")
	}
}

// watch 应在替身进程越过宽限窗后意外退出时把状态置为 failed。脚本先睡过
// 400ms 宽限窗再退出，退出码 7。
func TestWatchReportsUnexpectedExit(t *testing.T) {
	target := filepath.Join(t.TempDir(), "mnt")
	ws := workspaceWithMountEdge(t, target)
	store := New(events.New())

	rc := rclone.NewSupervisor(rclone.Settings{Bin: writeScript(t, "sleep 0.7\nexit 7")})
	if _, err := store.Start(rc, ws, "m1"); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for {
		snapshot := store.List(ws)[0]
		if snapshot.Status == StatusFailed {
			if snapshot.ExitCode == nil || *snapshot.ExitCode != 7 {
				t.Fatalf("exit code %v", snapshot.ExitCode)
			}
			return
		}
		if snapshot.Status == StatusMounted && time.Now().After(deadline) {
			t.Fatalf("snapshot never failed: %v", snapshot.Status)
		}
		time.Sleep(50 * time.Millisecond)
	}
}
