package units

import "testing"

func TestParseSize(t *testing.T) {
	cases := []struct {
		value string
		want  int64
	}{
		{"100", 100},
		{"1.5K", 1536},
		{"10MiB", 10 << 20},
		{"2gib", 2 << 30},
		{"1B", 1},
	}
	for _, c := range cases {
		got, err := ParseSize(c.value)
		if err != nil {
			t.Fatalf("%q: %v", c.value, err)
		}
		if got != c.want {
			t.Fatalf("%q = %d, want %d", c.value, got, c.want)
		}
	}
	for _, value := range []string{"", "abc", "1X", "10M:00:00", "-5M"} {
		if _, err := ParseSize(value); err == nil {
			t.Fatalf("%q should fail", value)
		}
	}
}

func TestIsOff(t *testing.T) {
	for _, value := range []string{"", "  ", "off", "OFF", " Off "} {
		if !IsOff(value) {
			t.Errorf("IsOff(%q) = false", value)
		}
	}
	for _, value := range []string{"0", "10M", "none"} {
		if IsOff(value) {
			t.Errorf("IsOff(%q) = true", value)
		}
	}
}

func TestValidateLimit(t *testing.T) {
	for _, value := range []string{"", "off", "OFF", "10MiB", "1.5G"} {
		if err := ValidateLimit(value); err != nil {
			t.Errorf("ValidateLimit(%q): %v", value, err)
		}
	}
	for _, value := range []string{"bogus", "10M:00:00", "-1M", "5X"} {
		if err := ValidateLimit(value); err == nil {
			t.Errorf("ValidateLimit(%q) should fail", value)
		}
	}
}
