package persist

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/gsxhnd/ourboros/internal/core"
)

type doc struct {
	SchemaVersion uint32 `json:"schema_version"`
	Name          string `json:"name"`
}

func writeFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "doc.json")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func migrateDoc(value map[string]any, version uint32) error {
	switch version {
	case 0:
		value["schema_version"] = 1
		if _, ok := value["name"]; !ok {
			value["name"] = "defaulted"
		}
	case 1:
	default:
		return core.UnsupportedSchema("doc", version)
	}
	return nil
}

func TestLoadVersionedCurrentVersion(t *testing.T) {
	got, err := LoadVersioned[doc](writeFile(t, `{"schema_version":1,"name":"x"}`), "doc", migrateDoc)
	if err != nil || got.Name != "x" || got.SchemaVersion != 1 {
		t.Fatalf("got (%+v, %v)", got, err)
	}
}

func TestLoadVersionedMigratesMissingVersion(t *testing.T) {
	got, err := LoadVersioned[doc](writeFile(t, `{}`), "doc", migrateDoc)
	if err != nil || got.SchemaVersion != 1 || got.Name != "defaulted" {
		t.Fatalf("got (%+v, %v)", got, err)
	}
}

func TestLoadVersionedPassesVersionToMigrate(t *testing.T) {
	var seen uint32 = 99
	_, err := LoadVersioned[doc](writeFile(t, `{"schema_version":1}`), "doc", func(_ map[string]any, v uint32) error {
		seen = v
		return nil
	})
	if err != nil || seen != 1 {
		t.Fatalf("seen=%d err=%v", seen, err)
	}
}

func coreKind(err error) (core.Kind, bool) {
	var coreErr *core.Error
	if errors.As(err, &coreErr) {
		return coreErr.Kind, true
	}
	return 0, false
}

func TestLoadVersionedRejectsNewerSchema(t *testing.T) {
	_, err := LoadVersioned[doc](writeFile(t, `{"schema_version":7}`), "doc", migrateDoc)
	if kind, ok := coreKind(err); !ok || kind != core.KindUnsupportedSchema {
		t.Fatalf("err = %v", err)
	}
}

func TestLoadVersionedReportsCorruptJSON(t *testing.T) {
	for name, content := range map[string]string{"garbage": `{not json`, "null": `null`, "array": `[1,2]`} {
		_, err := LoadVersioned[doc](writeFile(t, content), "doc", migrateDoc)
		if kind, ok := coreKind(err); !ok || kind != core.KindCorruptStore {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func TestLoadVersionedReportsMissingFile(t *testing.T) {
	_, err := LoadVersioned[doc](filepath.Join(t.TempDir(), "absent.json"), "doc", migrateDoc)
	if kind, ok := coreKind(err); !ok || kind != core.KindIO {
		t.Fatalf("err = %v", err)
	}
}

func TestLoadVersionedReportsTypeMismatchAsCorrupt(t *testing.T) {
	_, err := LoadVersioned[doc](writeFile(t, `{"schema_version":1,"name":123}`), "doc", migrateDoc)
	if kind, ok := coreKind(err); !ok || kind != core.KindCorruptStore {
		t.Fatalf("err = %v", err)
	}
}
