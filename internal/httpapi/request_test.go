package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONRejectsTrailingContent(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{"a":1} {"b":2}`))
	var body map[string]any
	err := decodeJSON(r, &body)
	if err == nil {
		t.Fatal("expected error for trailing content")
	}
	if !strings.Contains(err.Error(), "trailing") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDecodeJSONRejectsOversizedBody(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{"a":1}`))
	r.Header.Set("Content-Length", "99999999")
	var body map[string]any
	err := decodeJSON(r, &body)
	if err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("expected body-size error, got %v", err)
	}
}

func TestDecodeJSONAcceptsNormalBody(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{"a":1}`))
	var body struct {
		A int `json:"a"`
	}
	if err := decodeJSON(r, &body); err != nil {
		t.Fatal(err)
	}
	if body.A != 1 {
		t.Fatalf("a=%d", body.A)
	}
}

func TestCheckBodySizeFromHeaderOnly(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{}`))
	r.Header.Set("Content-Length", "10")
	if err := checkBodySize(r); err != nil {
		t.Fatal(err)
	}
	r.Header.Set("Content-Length", "99999999")
	if err := checkBodySize(r); err == nil {
		t.Fatal("expected error for oversized content-length")
	}
}
