package workspace

import (
	"testing"
)

func TestValidateLimits(t *testing.T) {
	for _, value := range []string{"", "off", "OFF", "10MiB"} {
		if err := ValidateBWLimit(value); err != nil {
			t.Fatalf("bwlimit %q: %v", value, err)
		}
		if err := ValidateMaxTransfer(value); err != nil {
			t.Fatalf("max_transfer %q: %v", value, err)
		}
	}
	if err := ValidateBWLimit("bogus"); err == nil {
		t.Fatal("bogus bwlimit should fail")
	}
}
