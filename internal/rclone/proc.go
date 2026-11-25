package rclone

import (
	"os"
	"os/exec"
	"time"
)

type childProc struct {
	cmd  *exec.Cmd
	done chan struct{}
}

func startCommand(cmd *exec.Cmd) (*childProc, error) {
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	proc := &childProc{cmd: cmd, done: make(chan struct{})}
	go func() {
		_ = cmd.Wait()
		close(proc.done)
	}()
	return proc, nil
}

func (p *childProc) exited() bool {
	if p == nil {
		return true
	}
	select {
	case <-p.done:
		return true
	default:
		return false
	}
}

func (p *childProc) kill() {
	if p == nil || p.cmd.Process == nil {
		return
	}
	_ = p.cmd.Process.Kill()
	select {
	case <-p.done:
	case <-time.After(3 * time.Second):
	}
}

// stop asks the process to exit with SIGINT so rclone can clean up (rclone
// mount unmounts its volume on interrupt), and force-kills it if it is still
// alive after timeout. On platforms without signal support (Windows) the
// interrupt fails immediately and the process is killed right away.
func (p *childProc) stop(timeout time.Duration) {
	if p == nil || p.cmd.Process == nil {
		return
	}
	if err := p.cmd.Process.Signal(os.Interrupt); err != nil {
		p.kill()
		return
	}
	select {
	case <-p.done:
		return
	case <-time.After(timeout):
	}
	p.kill()
}

func (p *childProc) exitCode() *int {
	if p == nil || p.cmd.ProcessState == nil {
		return nil
	}
	code := p.cmd.ProcessState.ExitCode()
	return &code
}
