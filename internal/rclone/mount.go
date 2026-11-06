package rclone

import (
	"bufio"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
)

type SpawnedMount struct {
	Child  *childProc
	Stderr chan string
}

func SpawnMount(settings Settings, source paths.Locator, mountPoint string, extra []string) (*SpawnedMount, error) {
	if err := os.MkdirAll(mountPoint, 0o755); err != nil {
		return nil, core.IO(err)
	}
	args := []string{"mount", source.CombinedFS(), mountPoint}
	if settings.Config != "" {
		args = append(args, "--config", settings.Config)
	}
	args = append(args, extra...)
	cmd := exec.Command(settings.Bin, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, core.IO(err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, core.IO(err)
	}
	slog.Info("starting rclone mount", "bin", settings.Bin, "source", source.Display(), "mount_point", mountPoint)
	child, err := startCommand(cmd)
	if err != nil {
		if isNotFound(err) {
			return nil, core.BinaryNotFound(settings.Bin)
		}
		return nil, core.IO(err)
	}
	lines := make(chan string, 64)
	go collectLines(stderr, lines)
	go drainLines(stdout, "rclone.mount")
	return &SpawnedMount{Child: child, Stderr: lines}, nil
}

func collectLines(r io.Reader, dst chan string) {
	defer close(dst)
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		slog.Debug(line, "target", "rclone.mount")
		select {
		case dst <- line:
		default:
		}
	}
}

func (s *SpawnedMount) Exited() bool {
	return s == nil || s.Child == nil || s.Child.exited()
}

// Done exposes a receive-only channel that closes when the mount process is
// gone, so supervisors can watch for an unexpected exit without polling.
func (s *SpawnedMount) Done() <-chan struct{} {
	if s == nil || s.Child == nil {
		closed := make(chan struct{})
		close(closed)
		return closed
	}
	return s.Child.done
}

// mountStopTimeout is how long rclone mount has to unmount after SIGINT.
const mountStopTimeout = 5 * time.Second

// Stop unmounts gracefully (SIGINT), force-killing rclone only if it does not
// exit in time. A plain kill would leave a stale mount point behind.
func (s *SpawnedMount) Stop() {
	if s != nil && s.Child != nil {
		s.Child.stop(mountStopTimeout)
	}
}

func (s *SpawnedMount) ExitCode() *int {
	if s == nil || s.Child == nil {
		return nil
	}
	return s.Child.exitCode()
}

// DrainStderr returns every line currently buffered on ch, joined by newlines,
// without blocking.
func DrainStderr(ch chan string) string {
	var lines []string
	for {
		select {
		case line, ok := <-ch:
			if !ok {
				return strings.Join(lines, "\n")
			}
			lines = append(lines, line)
		default:
			return strings.Join(lines, "\n")
		}
	}
}
