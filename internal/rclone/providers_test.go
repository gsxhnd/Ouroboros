package rclone

import (
	"encoding/json"
	"testing"
)

func TestParseProvidersDropsHiddenAndSecrets(t *testing.T) {
	body := map[string]any{}
	if err := json.Unmarshal([]byte(`{
		"providers": [
			{"Name": "hidden", "Hide": true, "Options": [{"Name": "x", "Type": "string"}]},
			{"Name": "sftp", "Description": "SSH", "Prefix": "sftp", "Options": [
				{"Name": "host", "Help": "host", "Type": "string", "Required": true, "Hide": 0},
				{"Name": "pass", "Type": "string", "IsPassword": true, "Sensitive": true, "Value": "secret"},
				{"Name": "internal", "Type": "string", "Hide": 2},
				{"Name": "port", "Type": "int", "Default": 22, "DefaultStr": "22", "Advanced": false}
			]}
		]
	}`), &body); err != nil {
		t.Fatal(err)
	}
	got, err := ParseProviders(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "sftp" || len(got[0].Options) != 3 {
		t.Fatalf("%+v", got)
	}
	if got[0].Options[1].Name != "pass" || !got[0].Options[1].Password {
		t.Fatalf("%+v", got[0].Options[1])
	}
	if got[0].Options[2].Default != "22" {
		t.Fatalf("default %q", got[0].Options[2].Default)
	}
}

func TestPublicParametersOmitsSecrets(t *testing.T) {
	providers := []Provider{{
		Name: "s3",
		Options: []ProviderOption{
			{Name: "endpoint"},
			{Name: "access_key_id", Sensitive: true},
			{Name: "secret_access_key", Password: true, Sensitive: true},
		},
	}}
	got := PublicParameters(providers, "s3", map[string]any{
		"type":              "s3",
		"endpoint":          "https://s3.example",
		"access_key_id":     "AKIA",
		"secret_access_key": "super-secret",
	})
	if got["endpoint"] != "https://s3.example" {
		t.Fatal(got)
	}
	if _, ok := got["access_key_id"]; ok {
		t.Fatal("access key leaked")
	}
	if _, ok := got["secret_access_key"]; ok {
		t.Fatal("secret leaked")
	}
	if len(PublicParameters(providers, "missing", map[string]any{"token": "x"})) != 0 {
		t.Fatal("unknown backend should return nothing")
	}
}

func TestRemoteTypesOnlyReadsType(t *testing.T) {
	got := RemoteTypes(map[string]any{
		"disk": map[string]any{"type": "alias", "remote": "/tmp"},
	})
	if got["disk"] != "alias" {
		t.Fatal(got)
	}
}

func TestPublicEndpointStripsUserinfo(t *testing.T) {
	got := PublicEndpoint("http://user:secret@127.0.0.1:5572/")
	if got != "http://127.0.0.1:5572" {
		t.Fatal(got)
	}
	if PublicEndpoint("") != "" || PublicEndpoint("not a url") != "" {
		t.Fatal("blank or invalid endpoint should be omitted")
	}
}
