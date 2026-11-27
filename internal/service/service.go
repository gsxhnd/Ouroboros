// Package service contains application use cases, independently of any
// transport. HTTP handlers and the desktop shell both enter through Services.
package service

import (
	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/events"
)

// Services is the single entry point exposed to transport bridges.
type Services struct {
	System    *System
	Rclone    *RcloneRuntime
	Remotes   *Remotes
	Files     *Files
	SyncTasks *SyncTasks
	Mounts    *Mounts
	Settings  *Settings
	Workspace *Workspace
	RC        *RCProxy

	state *app.State
}

func New(state *app.State) *Services {
	base := serviceBase{state: state}
	return &Services{
		System:    &System{serviceBase: base},
		Rclone:    &RcloneRuntime{serviceBase: base},
		Remotes:   &Remotes{serviceBase: base},
		Files:     &Files{serviceBase: base},
		SyncTasks: &SyncTasks{serviceBase: base},
		Mounts:    &Mounts{serviceBase: base},
		Settings:  &Settings{serviceBase: base},
		Workspace: &Workspace{serviceBase: base},
		RC:        &RCProxy{serviceBase: base},
		state:     state,
	}
}

// Events exposes the domain event stream for transports such as SSE and the
// desktop settings watcher. Publishing remains a service/domain responsibility.
func (s *Services) Events() *events.Bus { return s.state.Events }

// AuthToken and Origins are transport configuration consumed by the HTTP
// bridge. In-process callers do not pass through HTTP authentication.
func (s *Services) AuthToken() string { return s.state.AuthToken }
func (s *Services) Origins() []string { return s.state.Origins }
