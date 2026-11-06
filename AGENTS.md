# AGENTS.md

Ourboros is a Web UI for rclone. A Go HTTP service manages a loopback rclone RC process and proxies it under `/api/rc/*`. The React app in `web/` talks only to the typed Ourboros API, never to RC directly. `cmd/desktop` is a Wails window that opens the same HTTP service.

## Commands

Go is 1.26 and Node is 24 per `mise.toml`. CI uses Node 22, so use the local toolchain from mise when they disagree.

- Go tests (the CI scope): `go test ./internal/... ./cmd/ourboros`
- Single Go test: `go test ./internal/rclone -run TestName`
- Web checks, in this order: `cd web && npm run typecheck && npm run lint && npm run build`
- Web build runs `tsc -b` then `vite build`, so it also type-checks. `web/` has no test runner.
- Run the API: `go run ./cmd/ourboros server` (127.0.0.1:8080). Add `--no-auto-rclone` to skip starting rclone.
- Run the UI in dev: `cd web && npm run dev` (127.0.0.1:1420). Vite proxies `/api` and `/health` to 8080, so start the API first.
- Serve the built UI from Go: `cd web && npm run build`, then `go run ./cmd/ourboros server --webui ./web/dist`.
- Desktop: `go run ./cmd/desktop --webui ./web/dist`. It needs the `web/dist` build and, on macOS, Xcode CLT. Linux needs GTK4 and WebKitGTK 6.0. CI does not build the desktop app.
- Format Go with `gofmt -w cmd internal`. Format web with `npm run format`.

## Layout

- `cmd/ourboros`: service entrypoint. `cmd/desktop`: Wails entrypoint plus tray code.
- `internal/serve`: startup wiring. `Run` validates the bind host, resolves the web dir, starts app state and rclone, then starts the HTTP server.
- `internal/httpapi`: handlers and error mapping. `internal/rclone`: process supervision, RC client, download/discovery. `internal/workspace`: versioned JSON documents and validation. `internal/mounts`, `internal/scheduler`, `internal/jobs`, `internal/settings`, `internal/persist`: supporting state.
- `web/src`: React app. `components/canvas`, `lib/canvas`, `stores/canvas-store.ts`, and `pages/` are the canvas workspace. The i18n locale files are `web/src/i18n/locales/{en,zh}.json`.
- `docs/dev/` holds the design docs, written in Chinese. `10-设计决策与注意事项.md` lists the rules below in full, and `11-打包和发布指南.md` covers release.

## Constraints that are easy to break

- The server refuses to bind non-loopback addresses (`cli.AssertBindHost`). Do not relax this without adding HTTP auth, CSRF/Origin checks, and TLS first.
- RC binds only to 127.0.0.1. Never return RC URLs, RC credentials, remote tokens, or `config/dump` to the browser or the logs.
- Typed API input must validate remote names, relative paths, absolute local paths, operation kind, and edge direction.
- Dangerous operations (`sync`, `move`, delete, purge, mount) must show source, target, and impact in the UI before running.
- Workspace and settings JSON carry a schema version and are written atomically. Workspace saves use revision-based optimistic concurrency, and conflicts return 409.
- rclone may be missing. The service must still start, and rclone-dependent operations return a diagnosable not-ready state. Never overwrite an rclone installed by a system package manager.
- An explicit `--webui` path without `index.html` is a startup error. Without the flag, the server runs in API-only mode.
- Mount is remote → local only. Mount options are not passed through from the frontend without platform validation.
- Auto-restore of mounts is off by default. Turning it on needs the startup, PID, and cleanup work described in `docs/dev/10-设计决策与注意事项.md`.
