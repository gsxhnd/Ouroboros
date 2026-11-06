package rclone

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/version"
)

// gracefulStopTimeout bounds how long a managed rclone rcd gets to exit after
// core/quit or SIGINT before it is force-killed.
const gracefulStopTimeout = 3 * time.Second

// serveClient streams file bodies between the browser and the RC file server.
// It has no overall timeout so large downloads can finish; cancellation comes
// from the caller's request context instead.
var serveClient = &http.Client{}

type session struct {
	mode   Mode
	rcURL  string
	auth   *Auth
	info   VersionInfo
	binary string
	child  *childProc
}

type Supervisor struct {
	client *Client
	mu     sync.Mutex
	inner  struct {
		settings Settings
		session  *session
	}
}

func NewSupervisor(settings Settings) *Supervisor {
	if settings.Bin == "" {
		settings.Bin = "rclone"
	}
	s := &Supervisor{client: NewClient()}
	s.inner.settings = settings
	return s
}

func (s *Supervisor) Client() *Client { return s.client }

func (s *Supervisor) Settings() Settings {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.inner.settings
}

func (s *Supervisor) UpdateSettings(mutate func(*Settings)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	mutate(&s.inner.settings)
}

func (s *Supervisor) EnsureRunning(ctx context.Context) (Status, error) {
	s.reap()
	if s.Status().Running {
		return s.Ping(ctx)
	}
	return s.Start(ctx)
}

func (s *Supervisor) Start(ctx context.Context) (Status, error) {
	s.reap()
	s.mu.Lock()
	if s.inner.session != nil {
		s.mu.Unlock()
		return Status{}, core.AlreadyRunning()
	}
	settings := s.inner.settings
	s.mu.Unlock()

	var (
		mode   Mode
		rcURL  string
		auth   *Auth
		child  *childProc
		binary = settings.Bin
	)
	if settings.RCURL != "" {
		url, urlAuth, err := ParseAttachURL(settings.RCURL)
		if err != nil {
			return Status{}, err
		}
		auth = urlAuth
		if auth == nil && settings.RCUser != "" && settings.RCPass != "" {
			auth = &Auth{User: settings.RCUser, Pass: settings.RCPass}
		}
		if err := waitUntilReady(ctx, s.client, url, auth, nil); err != nil {
			return Status{}, err
		}
		mode = ModeAttached
		rcURL = url
	} else {
		spawned, err := spawnDaemon(ctx, settings, s.client)
		if err != nil {
			return Status{}, err
		}
		mode = ModeSpawned
		rcURL = spawned.rcURL
		auth = &spawned.auth
		child = spawned.child
	}

	info, err := s.client.Version(ctx, rcURL, auth)
	if err != nil {
		if child != nil {
			child.kill()
		}
		return Status{}, err
	}

	s.mu.Lock()
	if s.inner.session != nil {
		s.mu.Unlock()
		if child != nil {
			child.kill()
		}
		return Status{}, core.AlreadyRunning()
	}
	s.inner.session = &session{
		mode:   mode,
		rcURL:  rcURL,
		auth:   auth,
		info:   info,
		binary: binary,
		child:  child,
	}
	s.mu.Unlock()
	slog.Info("rclone rc is ready", "version", info.Version, "mode", mode)
	return s.Status(), nil
}

func (s *Supervisor) Stop(ctx context.Context) (Status, error) {
	s.mu.Lock()
	session := s.inner.session
	s.inner.session = nil
	s.mu.Unlock()
	if session == nil {
		return Status{}, core.NotRunning()
	}
	if session.mode == ModeSpawned {
		if session.auth != nil {
			_, _ = s.client.Call(ctx, session.rcURL, session.auth, "core/quit", map[string]any{})
		}
		session.child.stop(gracefulStopTimeout)
	}
	return s.Status(), nil
}

func (s *Supervisor) Ping(ctx context.Context) (Status, error) {
	s.reap()
	rcURL, auth, err := s.endpoint()
	if err != nil {
		return Status{}, err
	}
	info, err := s.client.Version(ctx, rcURL, auth)
	if err != nil {
		return Status{}, err
	}
	s.mu.Lock()
	if s.inner.session != nil {
		s.inner.session.info = info
	}
	s.mu.Unlock()
	return s.Status(), nil
}

func (s *Supervisor) CallAllowed(ctx context.Context, command string, body any) (Response, error) {
	if err := ValidateProxyCommand(command); err != nil {
		return Response{}, err
	}
	return s.CallInternal(ctx, command, body)
}

func (s *Supervisor) CallInternal(ctx context.Context, command string, body any) (Response, error) {
	s.reap()
	rcURL, auth, err := s.endpoint()
	if err != nil {
		return Response{}, err
	}
	return s.client.Call(ctx, rcURL, auth, command, body)
}

// OpenServe performs an authenticated GET against the RC file server (enabled
// by --rc-serve on spawned daemons) and returns the raw response so the caller
// can stream the body to the browser. Credentials are only ever sent to the
// loopback RC process and never appear in returned URLs, logs or error text.
func (s *Supervisor) OpenServe(ctx context.Context, urlPath string) (*http.Response, error) {
	s.reap()
	rcURL, auth, err := s.endpoint()
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, JoinRCURL(rcURL, urlPath), nil)
	if err != nil {
		return nil, core.Transport(redactAuth(err.Error(), auth))
	}
	req.Header.Set("User-Agent", "ourboros/"+version.Version)
	if auth != nil {
		req.SetBasicAuth(auth.User, auth.Pass)
	}
	res, err := serveClient.Do(req)
	if err != nil {
		return nil, core.Transport(redactAuth(err.Error(), auth))
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, core.Transport(fmt.Sprintf("rclone file server returned status %d", res.StatusCode))
	}
	return res, nil
}

func (s *Supervisor) ListRemotes(ctx context.Context) ([]string, error) {
	res, err := s.CallInternal(ctx, "config/listremotes", map[string]any{})
	if err != nil {
		return nil, err
	}
	if !res.OK() {
		return nil, core.Transport(upstreamMessage(res.Body))
	}
	raw, ok := res.Body["remotes"].([]any)
	if !ok {
		return []string{}, nil
	}
	names := make([]string, 0, len(raw))
	for _, item := range raw {
		if name, ok := item.(string); ok {
			names = append(names, name)
		}
	}
	return names, nil
}

func (s *Supervisor) Status() Status {
	s.reap()
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.statusLocked()
}

func (s *Supervisor) SelectedBin() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.inner.session != nil {
		return s.inner.session.binary
	}
	return s.inner.settings.Bin
}

func (s *Supervisor) statusLocked() Status {
	status := Status{Running: false, Binary: s.inner.settings.Bin}
	if endpoint := PublicEndpoint(s.inner.settings.RCURL); endpoint != "" {
		status.Endpoint = &endpoint
	}
	if s.inner.settings.Config != "" {
		config := s.inner.settings.Config
		status.Config = &config
	}
	if s.inner.session == nil {
		return status
	}
	status.Running = true
	status.Binary = s.inner.session.binary
	mode := s.inner.session.mode
	status.Mode = &mode
	applyVersion(&status, s.inner.session.info)
	if endpoint := PublicEndpoint(s.inner.session.rcURL); endpoint != "" {
		status.Endpoint = &endpoint
	}
	return status
}

func applyVersion(status *Status, info VersionInfo) {
	status.Version = strPtr(info.Version)
	status.OS = strPtr(info.OS)
	status.Arch = strPtr(info.Arch)
	status.OSVersion = strPtr(info.OSVersion)
	status.GoVersion = strPtr(info.GoVersion)
	status.Linking = strPtr(info.Linking)
	if info.IsBeta {
		beta := true
		status.Beta = &beta
	}
}

func strPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func (s *Supervisor) endpoint() (string, *Auth, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.inner.session == nil {
		return "", nil, core.NotRunning()
	}
	return s.inner.session.rcURL, s.inner.session.auth, nil
}

func (s *Supervisor) reap() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.inner.session == nil || s.inner.session.child == nil {
		return
	}
	if s.inner.session.child.exited() {
		slog.Warn("rclone process exited unexpectedly")
		s.inner.session = nil
	}
}
