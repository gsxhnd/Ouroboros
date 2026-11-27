package service

import "github.com/gsxhnd/ourboros/internal/rclone"

type SystemInfo struct {
	Name    string        `json:"name"`
	Version string        `json:"version"`
	HomeDir *string       `json:"home_dir"`
	Rclone  rclone.Status `json:"rclone"`
}

type System struct{ serviceBase }

func (s *System) Info() SystemInfo {
	var home *string
	if s.state.HomeDir != "" {
		value := s.state.HomeDir
		home = &value
	}
	return SystemInfo{
		Name:    "ourboros",
		Version: s.state.Version,
		HomeDir: home,
		Rclone:  s.state.Rclone.Status(),
	}
}
