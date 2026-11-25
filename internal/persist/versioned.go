package persist

import (
	"encoding/json"
	"fmt"

	"github.com/gsxhnd/ourboros/internal/core"
)

// LoadVersioned reads a JSON document that carries a "schema_version" field.
//
// The raw object is handed to migrate together with the version it was
// written at (0 when the field is absent); migrate upgrades it in place and
// returns core.UnsupportedSchema for a version it does not know. The upgraded
// object is then decoded into T. name labels errors ("settings", "workspace").
func LoadVersioned[T any](path, name string, migrate func(value map[string]any, version uint32) error) (T, error) {
	var zero T
	data, err := ReadJSONBytes(path)
	if err != nil {
		return zero, err
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		return zero, core.CorruptStore(path + ": " + err.Error())
	}
	if value == nil {
		return zero, core.CorruptStore(fmt.Sprintf("%s document is not an object", name))
	}
	version := uint32(0)
	if raw, ok := value["schema_version"].(float64); ok {
		version = uint32(raw)
	}
	if err := migrate(value, version); err != nil {
		return zero, err
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return zero, core.CorruptStore(name + ": " + err.Error())
	}
	var doc T
	if err := json.Unmarshal(raw, &doc); err != nil {
		return zero, core.CorruptStore(name + ": " + err.Error())
	}
	return doc, nil
}
