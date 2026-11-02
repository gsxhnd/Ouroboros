package settings

import (
	"bytes"
	"encoding/json"
	"os"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/persist"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

const SchemaVersion = 1

type Document struct {
	SchemaVersion uint32            `json:"schema_version"`
	RcloneSource  rclone.SourceKind `json:"rclone_source"`
	RcloneBin     *string           `json:"rclone_bin"`
	RcloneConfig  *string           `json:"rclone_config"`
	RcloneRCURL   *string           `json:"rclone_rc_url"`
	AutoStart     bool              `json:"auto_start"`
	WorkspacePath *string           `json:"workspace_path"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

func DefaultDocument() Document {
	return Document{
		SchemaVersion: SchemaVersion,
		RcloneSource:  rclone.SourceSystem,
		UpdatedAt:     time.Now().UTC(),
	}
}

type Nullable[T any] struct {
	Set   bool
	Value *T
}

func (n *Nullable[T]) UnmarshalJSON(data []byte) error {
	n.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		n.Value = nil
		return nil
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	n.Value = &value
	return nil
}

type Patch struct {
	RcloneSource  *rclone.SourceKind `json:"rclone_source"`
	RcloneBin     Nullable[string]   `json:"rclone_bin"`
	RcloneConfig  Nullable[string]   `json:"rclone_config"`
	RcloneRCURL   Nullable[string]   `json:"rclone_rc_url"`
	AutoStart     *bool              `json:"auto_start"`
	WorkspacePath Nullable[string]   `json:"workspace_path"`
}

type Store struct {
	mu   sync.Mutex
	path string
	doc  Document
}

func LoadOrCreate(path string) (*Store, error) {
	var doc Document
	if _, err := os.Stat(path); err == nil {
		loaded, err := load(path)
		if err != nil {
			return nil, err
		}
		doc = loaded
	} else if os.IsNotExist(err) {
		doc = DefaultDocument()
		if err := persist.AtomicWriteJSON(path, doc); err != nil {
			return nil, err
		}
	} else {
		return nil, core.IO(err)
	}
	return &Store{path: path, doc: doc}, nil
}

func (s *Store) Get() Document {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.doc
}

func (s *Store) Patch(patch Patch) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if patch.RcloneSource != nil {
		s.doc.RcloneSource = *patch.RcloneSource
	}
	if patch.RcloneBin.Set {
		s.doc.RcloneBin = patch.RcloneBin.Value
	}
	if patch.RcloneConfig.Set {
		s.doc.RcloneConfig = patch.RcloneConfig.Value
	}
	if patch.RcloneRCURL.Set {
		s.doc.RcloneRCURL = patch.RcloneRCURL.Value
	}
	if patch.AutoStart != nil {
		s.doc.AutoStart = *patch.AutoStart
	}
	if patch.WorkspacePath.Set {
		s.doc.WorkspacePath = patch.WorkspacePath.Value
	}
	s.doc.UpdatedAt = time.Now().UTC()
	if err := persist.AtomicWriteJSON(s.path, s.doc); err != nil {
		return Document{}, err
	}
	return s.doc, nil
}

func ApplyToRclone(doc Document, settings *rclone.Settings) {
	if doc.RcloneBin != nil && *doc.RcloneBin != "" {
		settings.Bin = *doc.RcloneBin
	}
	if settings.Config == "" && doc.RcloneConfig != nil {
		settings.Config = *doc.RcloneConfig
	}
	if settings.RCURL == "" && doc.RcloneRCURL != nil {
		settings.RCURL = *doc.RcloneRCURL
	}
}

func load(path string) (Document, error) {
	data, err := persist.ReadJSONBytes(path)
	if err != nil {
		return Document{}, err
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		return Document{}, core.CorruptStore(path + ": " + err.Error())
	}
	version := uint32(0)
	if raw, ok := value["schema_version"].(float64); ok {
		version = uint32(raw)
	}
	switch version {
	case 0:
		value["schema_version"] = SchemaVersion
		if _, ok := value["rclone_source"]; !ok {
			value["rclone_source"] = rclone.SourceSystem
		}
		if _, ok := value["auto_start"]; !ok {
			value["auto_start"] = false
		}
		if _, ok := value["rclone_rc_url"]; !ok {
			value["rclone_rc_url"] = nil
		}
		if _, ok := value["updated_at"]; !ok {
			value["updated_at"] = time.Now().UTC()
		}
	case SchemaVersion:
	default:
		return Document{}, core.UnsupportedSchema("settings", version)
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return Document{}, core.CorruptStore("settings: " + err.Error())
	}
	var doc Document
	if err := json.Unmarshal(raw, &doc); err != nil {
		return Document{}, core.CorruptStore("settings: " + err.Error())
	}
	if doc.RcloneSource == "" {
		doc.RcloneSource = rclone.SourceSystem
	}
	return doc, nil
}
