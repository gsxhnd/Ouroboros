package paths

import (
	"path/filepath"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

type Kind string

const (
	KindLocal  Kind = "local"
	KindRemote Kind = "remote"
)

type Locator struct {
	Kind   Kind   `json:"kind"`
	FS     string `json:"fs"`
	Remote string `json:"remote"`
}

func Parse(fs, remote string, home string) (Locator, error) {
	relative, err := ValidateRelative(remote)
	if err != nil {
		return Locator{}, err
	}
	if LooksLikeLocal(fs) {
		local, err := ValidateLocal(fs, home)
		if err != nil {
			return Locator{}, err
		}
		return Locator{Kind: KindLocal, FS: pathToString(local), Remote: relative}, nil
	}
	name, err := ValidateRemoteName(fs)
	if err != nil {
		return Locator{}, err
	}
	return Locator{Kind: KindRemote, FS: name, Remote: relative}, nil
}

func (l Locator) RcloneFS() string {
	switch l.Kind {
	case KindLocal:
		return l.FS
	default:
		if strings.HasSuffix(l.FS, ":") {
			return l.FS
		}
		return l.FS + ":"
	}
}

func (l Locator) RcloneRemote() string { return l.Remote }

func (l Locator) CombinedFS() string {
	fs := l.RcloneFS()
	if l.Remote == "" {
		return fs
	}
	remote := strings.TrimPrefix(l.Remote, "/")
	switch l.Kind {
	case KindLocal:
		return strings.TrimRight(fs, `/\`) + "/" + remote
	default:
		return fs + remote
	}
}

func (l Locator) Display() string { return l.CombinedFS() }

func LooksLikeLocal(fs string) bool {
	trimmed := strings.TrimSpace(fs)
	if trimmed == "" {
		return false
	}
	if trimmed == "~" || strings.HasPrefix(trimmed, "~/") || strings.HasPrefix(trimmed, `~\`) {
		return true
	}
	if filepath.IsAbs(trimmed) || strings.HasPrefix(trimmed, "/") || strings.HasPrefix(trimmed, `\`) {
		return true
	}
	return len(trimmed) >= 2 && trimmed[1] == ':'
}

func ValidateRemoteName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", core.InvalidPath("remote name is required")
	}
	if strings.HasSuffix(name, ":") {
		return ValidateRemoteName(strings.TrimRight(name, ":"))
	}
	first := name[0]
	if !isASCIIAlnum(first) {
		return "", core.InvalidPath("invalid remote name '" + name + "'")
	}
	for i := 1; i < len(name); i++ {
		ch := name[i]
		if !isASCIIAlnum(ch) && ch != '_' && ch != '-' && ch != '.' {
			return "", core.InvalidPath("invalid remote name '" + name + "'")
		}
	}
	return name, nil
}

func ValidateRelative(path string) (string, error) {
	normalized := strings.TrimSpace(strings.ReplaceAll(path, `\`, "/"))
	if normalized == "" {
		return "", nil
	}
	if strings.HasPrefix(normalized, "/") || filepath.IsAbs(normalized) {
		return "", core.InvalidPath("relative path must not be absolute")
	}
	if strings.Contains(normalized, ":") {
		return "", core.InvalidPath("relative path must not contain a drive or remote prefix")
	}
	var parts []string
	for _, component := range strings.Split(normalized, "/") {
		if component == "" || component == "." {
			continue
		}
		if component == ".." {
			return "", core.InvalidPath("path traversal is not allowed")
		}
		parts = append(parts, component)
	}
	return strings.Join(parts, "/"), nil
}

func ValidateLocal(path, home string) (string, error) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return "", core.InvalidPath("local path is required")
	}
	expanded, err := expandHome(trimmed, home)
	if err != nil {
		return "", err
	}
	if !filepath.IsAbs(expanded) {
		return "", core.InvalidPath("local path must be absolute: " + trimmed)
	}
	return lexicalNormalize(expanded)
}

func JoinRelative(base, child string) (string, error) {
	base, err := ValidateRelative(base)
	if err != nil {
		return "", err
	}
	child, err = ValidateRelative(child)
	if err != nil {
		return "", err
	}
	switch {
	case base == "" && child == "":
		return "", nil
	case base == "":
		return child, nil
	case child == "":
		return base, nil
	default:
		return base + "/" + child, nil
	}
}

func expandHome(path, home string) (string, error) {
	if path == "~" || strings.HasPrefix(path, "~/") || strings.HasPrefix(path, `~\`) {
		if home == "" {
			return "", core.InvalidPath("HOME is not available to expand ~")
		}
		if path == "~" {
			return home, nil
		}
		return filepath.Join(home, path[2:]), nil
	}
	return path, nil
}

func lexicalNormalize(path string) (string, error) {
	cleaned := filepath.Clean(path)
	if cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", core.InvalidPath("path traversal is not allowed")
	}
	return cleaned, nil
}

func pathToString(path string) string {
	return strings.ReplaceAll(path, `\`, "/")
}

func isASCIIAlnum(ch byte) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')
}
