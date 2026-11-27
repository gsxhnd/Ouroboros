package httpapi

import (
	"net/http"
	"testing"
)

// New remotes follow the strict workspace naming rule, so a name created here
// can always be used as a sync/mount endpoint later. Validation runs before
// rclone is contacted: a rejected name is a 400, an accepted one gets past it
// and fails later with 503 because the test state has no rclone.
func TestCreateRemoteUsesStrictNameRule(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	create := func(name string) int {
		status, _ := send(handler, http.MethodPost, "/api/remotes",
			`{"name":"`+name+`","type":"alias","parameters":{}}`)
		return status
	}
	for _, bad := range []string{"_leading", "-dash", ".dot", "has space", "a:b", "a/b", "ünï"} {
		if status := create(bad); status != http.StatusBadRequest {
			t.Errorf("create %q: status %d, want 400", bad, status)
		}
	}
	for _, good := range []string{"gdrive", "My-Drive_1", "a.b", "9lives"} {
		if status := create(good); status != http.StatusServiceUnavailable {
			t.Errorf("create %q: status %d, want 503 (past validation, rclone missing)", good, status)
		}
	}
}

// Existing remotes keep the lenient check so a legacy name created outside
// Ourboros can still be viewed and deleted.
func TestExistingRemoteNamesStayAddressable(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	status, _ := send(handler, http.MethodDelete, "/api/remotes/_legacy-name", "")
	if status == http.StatusBadRequest {
		t.Fatalf("status %d: a lenient-valid legacy name was rejected", status)
	}
	status, _ = send(handler, http.MethodDelete, "/api/remotes/a:b", "")
	if status != http.StatusBadRequest {
		t.Fatalf("status %d: a name with ':' must still be rejected", status)
	}
}
