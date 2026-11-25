package rclone

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/version"
)

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{http: &http.Client{
		Timeout: 120 * time.Second,
	}}
}

func (c *Client) Call(ctx context.Context, rcURL string, auth *Auth, command string, body any) (Response, error) {
	if err := ValidateCommand(command); err != nil {
		return Response{}, err
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return Response{}, core.InvalidRequest(err.Error())
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, JoinRCURL(rcURL, command), bytes.NewReader(payload))
	if err != nil {
		return Response{}, core.Transport(redactAuth(err.Error(), auth))
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "ourboros/"+version.Version)
	if auth != nil {
		req.SetBasicAuth(auth.User, auth.Pass)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return Response{}, core.Transport(redactAuth(err.Error(), auth))
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return Response{}, core.Transport(redactAuth(err.Error(), auth))
	}
	parsed := map[string]any{}
	if len(bytes.TrimSpace(raw)) > 0 {
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		if err := dec.Decode(&parsed); err != nil {
			parsed = map[string]any{"error": string(raw)}
		}
	}
	return Response{Status: res.StatusCode, Body: parsed}, nil
}

func (c *Client) Version(ctx context.Context, rcURL string, auth *Auth) (VersionInfo, error) {
	res, err := c.Call(ctx, rcURL, auth, "core/version", map[string]any{})
	if err != nil {
		return VersionInfo{}, err
	}
	if !res.OK() {
		return VersionInfo{}, core.Transport(redactAuth(upstreamMessage(res.Body), auth))
	}
	raw, err := json.Marshal(res.Body)
	if err != nil {
		return VersionInfo{}, core.Transport(err.Error())
	}
	var info VersionInfo
	if err := json.Unmarshal(raw, &info); err != nil {
		return VersionInfo{}, core.Transport(err.Error())
	}
	return info, nil
}

func (c *Client) GetText(ctx context.Context, rawURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", core.Transport(err.Error())
	}
	req.Header.Set("User-Agent", "ourboros/"+version.Version)
	res, err := c.http.Do(req)
	if err != nil {
		return "", core.Transport(err.Error())
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", core.Transport(err.Error())
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", core.Transport(fmt.Sprintf("GET %s returned %d", rawURL, res.StatusCode))
	}
	return string(body), nil
}

func (c *Client) GetStream(ctx context.Context, rawURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, core.Transport(err.Error())
	}
	req.Header.Set("User-Agent", "ourboros/"+version.Version)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, core.Transport(err.Error())
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		res.Body.Close()
		return nil, core.Transport(fmt.Sprintf("GET %s returned %d", rawURL, res.StatusCode))
	}
	return res, nil
}

// ErrorMessage returns the "error" text rclone put in the response body, or
// fallback when the body carries none.
func (r Response) ErrorMessage(fallback string) string {
	if message, ok := r.Body["error"].(string); ok && message != "" {
		return message
	}
	return fallback
}

// Err converts a non-2xx response into a core.Upstream error, and returns nil
// for a successful one.
func (r Response) Err(fallback string) error {
	if r.OK() {
		return nil
	}
	return core.Upstream(r.ErrorMessage(fallback))
}

func upstreamMessage(body map[string]any) string {
	return Response{Body: body}.ErrorMessage("rclone rc returned an error")
}

type Response struct {
	Status int
	Body   map[string]any
}

func (r Response) OK() bool { return r.Status >= 200 && r.Status < 300 }

type Auth struct {
	User string
	Pass string
}

type VersionInfo struct {
	Version   string `json:"version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	OSVersion string `json:"osVersion"`
	GoVersion string `json:"goVersion"`
	Linking   string `json:"linking"`
	IsBeta    bool   `json:"isBeta"`
}
