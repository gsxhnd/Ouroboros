package rclone

import (
	"bufio"
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
)

type spawnedDaemon struct {
	child *childProc
	rcURL string
	auth  Auth
}

func generateAuth() (Auth, error) {
	user, err := randomToken(16)
	if err != nil {
		return Auth{}, err
	}
	pass, err := randomToken(32)
	if err != nil {
		return Auth{}, err
	}
	return Auth{User: user, Pass: pass}, nil
}

func spawnDaemon(ctx context.Context, settings Settings, client *Client) (*spawnedDaemon, error) {
	port, err := pickLocalPort()
	if err != nil {
		return nil, err
	}
	rcAddr := "127.0.0.1:" + port
	rcURL := "http://" + rcAddr
	auth, err := generateAuth()
	if err != nil {
		return nil, core.IO(err)
	}
	// --rc-serve allows GET requests to stream remote objects through the RC
	// HTTP interface; ourboros uses it for /api/files/download. The RC always
	// has auth set (RCLONE_RC_USER/RCLONE_RC_PASS below) and stays on
	// 127.0.0.1, so the file server is never exposed unauthenticated.
	cmd := exec.Command(settings.Bin, "rcd", "--rc-addr", rcAddr, "--rc-job-expire-duration", "24h", "--rc-serve")
	cmd.Env = append(os.Environ(), "RCLONE_RC_USER="+auth.User, "RCLONE_RC_PASS="+auth.Pass)
	if settings.Config != "" {
		cmd.Args = append(cmd.Args, "--config", settings.Config)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, core.IO(err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, core.IO(err)
	}
	slog.Info("starting rclone rcd", "bin", settings.Bin, "rc_addr", rcAddr)
	child, err := startCommand(cmd)
	if err != nil {
		if isNotFound(err) {
			return nil, core.BinaryNotFound(settings.Bin)
		}
		return nil, core.IO(err)
	}
	go drainLines(stdout, "rclone.stdout")
	go drainLines(stderr, "rclone.stderr")
	if err := waitUntilReady(ctx, client, rcURL, &auth, child.exited); err != nil {
		child.kill()
		return nil, err
	}
	return &spawnedDaemon{child: child, rcURL: rcURL, auth: auth}, nil
}

func pickLocalPort() (string, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", core.IO(err)
	}
	defer ln.Close()
	_, port, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		return "", core.IO(err)
	}
	return port, nil
}

// waitUntilReady polls the RC endpoint until it answers. When exited is
// non-nil it is checked on every attempt so a daemon that dies on startup
// (bad flags, port clash) fails fast instead of waiting out the full timeout.
func waitUntilReady(ctx context.Context, client *Client, rcURL string, auth *Auth, exited func() bool) error {
	for i := 0; i < 50; i++ {
		if _, err := client.Version(ctx, rcURL, auth); err == nil {
			return nil
		}
		if exited != nil && exited() {
			return core.Transport("rclone rcd exited before it became ready")
		}
		select {
		case <-ctx.Done():
			return core.ReadyTimeout()
		case <-time.After(100 * time.Millisecond):
		}
	}
	return core.ReadyTimeout()
}

func drainLines(r io.Reader, target string) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		slog.Debug(scanner.Text(), "target", target)
	}
}

// randomToken returns n characters drawn from an alphanumeric alphabet using
// crypto/rand. It never falls back to a predictable value: a failed entropy
// read is returned as an error so the RC credentials are never weak.
func randomToken(n int) (string, error) {
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(buf), nil
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	if os.IsNotExist(err) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "not found") ||
		strings.Contains(err.Error(), "executable file not found")
}
