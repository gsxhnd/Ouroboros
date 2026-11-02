package rclone

import (
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
)

// Provider is a rclone backend the UI can render as a form.
type Provider struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Prefix      string           `json:"prefix"`
	Options     []ProviderOption `json:"options"`
}

// ProviderOption is one rclone config field, without any stored secret.
type ProviderOption struct {
	Name      string            `json:"name"`
	Help      string            `json:"help"`
	Type      string            `json:"type"`
	Required  bool              `json:"required"`
	Advanced  bool              `json:"advanced"`
	Password  bool              `json:"password"`
	Sensitive bool              `json:"sensitive"`
	Exclusive bool              `json:"exclusive"`
	Default   string            `json:"default,omitempty"`
	Provider  string            `json:"provider,omitempty"`
	Examples  []ProviderExample `json:"examples,omitempty"`
}

// ProviderExample is a suggested value for an option.
type ProviderExample struct {
	Value    string `json:"value"`
	Help     string `json:"help,omitempty"`
	Provider string `json:"provider,omitempty"`
}

type rawProviders struct {
	Providers []rawProvider `json:"providers"`
}

type rawProvider struct {
	Name        string
	Description string
	Prefix      string
	Hide        bool
	Options     []rawOption
}

type rawOption struct {
	Name       string
	Help       string
	Type       string
	Required   bool
	Advanced   bool
	IsPassword bool
	Sensitive  bool
	Exclusive  bool
	Hide       int
	Provider   string
	DefaultStr string
	Default    any
	Examples   []rawExample
}

type rawExample struct {
	Value    string
	Help     string
	Provider string
}

// ParseProviders keeps the fields the form needs and drops hidden backends,
// hidden options, and any current values rclone might attach.
func ParseProviders(body map[string]any) ([]Provider, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var parsed rawProviders
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	out := make([]Provider, 0, len(parsed.Providers))
	for _, provider := range parsed.Providers {
		if provider.Hide || provider.Name == "" {
			continue
		}
		item := Provider{
			Name:        provider.Name,
			Description: provider.Description,
			Prefix:      provider.Prefix,
			Options:     make([]ProviderOption, 0, len(provider.Options)),
		}
		for _, option := range provider.Options {
			if option.Hide != 0 || option.Name == "" {
				continue
			}
			examples := make([]ProviderExample, 0, len(option.Examples))
			for _, example := range option.Examples {
				if example.Value == "" {
					continue
				}
				examples = append(examples, ProviderExample{
					Value:    example.Value,
					Help:     example.Help,
					Provider: example.Provider,
				})
			}
			item.Options = append(item.Options, ProviderOption{
				Name:      option.Name,
				Help:      option.Help,
				Type:      option.Type,
				Required:  option.Required,
				Advanced:  option.Advanced,
				Password:  option.IsPassword,
				Sensitive: option.Sensitive,
				Exclusive: option.Exclusive,
				Default:   defaultString(option),
				Provider:  option.Provider,
				Examples:  examples,
			})
		}
		out = append(out, item)
	}
	return out, nil
}

func defaultString(option rawOption) string {
	if option.DefaultStr != "" {
		return option.DefaultStr
	}
	switch value := option.Default.(type) {
	case string:
		return value
	case bool:
		if value {
			return "true"
		}
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	}
	return ""
}

// RemoteTypes reads only the backend name from a config/dump body.
func RemoteTypes(body map[string]any) map[string]string {
	out := map[string]string{}
	for name, raw := range body {
		section, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := section["type"].(string)
		if kind != "" {
			out[name] = kind
		}
	}
	return out
}

// PublicParameters copies config/get fields the browser may show.
// Password and sensitive options are dropped. An unknown backend returns nothing.
func PublicParameters(providers []Provider, typeName string, body map[string]any) map[string]any {
	var match *Provider
	for i := range providers {
		if providers[i].Name == typeName {
			match = &providers[i]
			break
		}
	}
	out := map[string]any{}
	if match == nil {
		return out
	}
	secret := map[string]struct{}{}
	for _, option := range match.Options {
		if isCredential(option) {
			secret[option.Name] = struct{}{}
		}
	}
	for key, value := range body {
		if key == "type" {
			continue
		}
		if _, hidden := secret[key]; hidden {
			continue
		}
		out[key] = value
	}
	return out
}

// isCredential marks values that must not be sent back to the browser.
// rclone also flags hosts and usernames as sensitive; those stay editable.
func isCredential(option ProviderOption) bool {
	if option.Password {
		return true
	}
	if !option.Sensitive {
		return false
	}
	name := strings.ToLower(option.Name)
	for _, part := range []string{"key", "secret", "token", "pass"} {
		if strings.Contains(name, part) {
			return true
		}
	}
	return false
}

// PublicEndpoint is an RC address with userinfo removed.
func PublicEndpoint(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	parsed.User = nil
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/")
}
