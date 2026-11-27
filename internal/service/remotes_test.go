package service

import "testing"

func TestValidRemoteName(t *testing.T) {
	for _, good := range []string{"gdrive", "my-drive", "drive_1", "UPPER", "a.b"} {
		if !validRemoteName(good) {
			t.Errorf("validRemoteName(%q) = false", good)
		}
	}
	for _, bad := range []string{"drive:", "d:rive", " drive", "drive ", "a b", "", "a/b", "a\\b", "a\v b"} {
		if validRemoteName(bad) {
			t.Errorf("validRemoteName(%q) = true", bad)
		}
	}
}
