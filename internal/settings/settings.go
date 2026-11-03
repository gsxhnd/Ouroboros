package settings

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
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
	// Shortcuts maps an action ID (see ShortcutActions) to an accelerator such
	// as "CmdOrCtrl+Shift+O". Missing actions use DefaultShortcuts.
	Shortcuts map[string]string `json:"shortcuts"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// ShortcutActions lists the actions a shortcut can trigger, in display order.
var ShortcutActions = []string{"show_main", "toggle_panel", "toggle_rclone", "quit"}

// DefaultShortcuts are used for any action without a stored accelerator.
var DefaultShortcuts = map[string]string{
	"show_main":     "CmdOrCtrl+Shift+O",
	"toggle_panel":  "CmdOrCtrl+Shift+P",
	"toggle_rclone": "CmdOrCtrl+Shift+R",
	"quit":          "CmdOrCtrl+Q",
}

func DefaultDocument() Document {
	return Document{
		SchemaVersion: SchemaVersion,
		RcloneSource:  rclone.SourceSystem,
		Shortcuts:     map[string]string{},
		UpdatedAt:     time.Now().UTC(),
	}
}

// ResolvedShortcuts returns the accelerator for every action, applying
// defaults where the document has no value.
func (d Document) ResolvedShortcuts() map[string]string {
	out := make(map[string]string, len(DefaultShortcuts))
	for action, fallback := range DefaultShortcuts {
		out[action] = fallback
		if value, ok := d.Shortcuts[action]; ok && value != "" {
			out[action] = value
		}
	}
	return out
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
	// Shortcuts merges per-action accelerators. An empty value resets that
	// action to its default.
	Shortcuts map[string]string `json:"shortcuts"`
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

// shortcutModifiers mirrors the modifiers Wails understands in accelerators.
var shortcutModifiers = map[string]bool{
	"cmdorctrl": true, "cmd": true, "command": true, "ctrl": true,
	"optionoralt": true, "alt": true, "option": true, "shift": true, "super": true,
}

// validateAccelerator checks the shape of an accelerator: zero or more known
// modifiers followed by exactly one key. Wails rejects unknown keys when the
// binding is registered.
func validateAccelerator(accelerator string) error {
	parts := strings.Split(accelerator, "+")
	key := parts[len(parts)-1]
	if strings.TrimSpace(key) == "" {
		return core.InvalidRequest("shortcut has no key: " + accelerator)
	}
	for _, modifier := range parts[:len(parts)-1] {
		if !shortcutModifiers[strings.ToLower(modifier)] {
			return core.InvalidRequest("unknown shortcut modifier: " + modifier)
		}
	}
	return nil
}

func (s *Store) Patch(patch Patch) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for action, accelerator := range patch.Shortcuts {
		if _, known := DefaultShortcuts[action]; !known {
			return Document{}, core.InvalidRequest("unknown shortcut action: " + action)
		}
		if accelerator == "" {
			continue
		}
		if err := validateAccelerator(accelerator); err != nil {
			return Document{}, err
		}
	}
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
	if len(patch.Shortcuts) > 0 {
		if s.doc.Shortcuts == nil {
			s.doc.Shortcuts = map[string]string{}
		}
		for action, accelerator := range patch.Shortcuts {
			if accelerator == "" {
				delete(s.doc.Shortcuts, action)
				continue
			}
			s.doc.Shortcuts[action] = accelerator
		}
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
