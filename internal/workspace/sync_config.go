package workspace

import (
	"encoding/json"
	"time"
)

type SyncConfig struct {
	Name        string      `json:"name,omitempty"`
	Operation   Operation   `json:"operation"`
	BWLimit     string      `json:"bw_limit,omitempty"`
	MaxTransfer string      `json:"max_transfer,omitempty"`
	Schedule    Schedule    `json:"schedule"`
	Enabled     bool        `json:"enabled"`
	NextRun     *time.Time  `json:"next_run,omitempty"`
	LastResult  *LastResult `json:"last_result,omitempty"`
}

func (s *SyncConfig) UnmarshalJSON(data []byte) error {
	var raw struct {
		Name        string      `json:"name"`
		Operation   Operation   `json:"operation"`
		BWLimit     string      `json:"bw_limit"`
		MaxTransfer string      `json:"max_transfer"`
		Schedule    Schedule    `json:"schedule"`
		Enabled     *bool       `json:"enabled"`
		NextRun     *time.Time  `json:"next_run"`
		LastResult  *LastResult `json:"last_result"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	s.Name = raw.Name
	s.Operation = raw.Operation
	s.BWLimit = raw.BWLimit
	s.MaxTransfer = raw.MaxTransfer
	s.Schedule = raw.Schedule
	s.Enabled = true
	if raw.Enabled != nil {
		s.Enabled = *raw.Enabled
	}
	s.NextRun = raw.NextRun
	s.LastResult = raw.LastResult
	if s.Schedule.Timezone == "" {
		s.Schedule.Timezone = "UTC"
	}
	return nil
}

func DefaultSync(operation Operation) SyncConfig {
	return SyncConfig{
		Operation: operation,
		Schedule:  DisabledSchedule(),
		Enabled:   true,
	}
}
