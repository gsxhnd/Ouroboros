# AGENTS.md

Ourboros is a Web UI for rclone. A Go HTTP service manages a loopback rclone RC process and proxies it under `/api/rc/*`. The React app in `frontend/` talks only to the typed Ourboros API, never to RC directly. `cmd/desktop` is a Wails window that opens the same HTTP service.

## Commands

Go is 1.26 and Node is 24 per `mise.toml`. CI uses Node 22.18 (the first 22.x that runs `.ts` files without a flag, which `npm test` needs), so use the local toolchain from mise when they disagree.

- Go tests (the CI scope): `go test ./internal/... ./cmd/ourboros`
- Single Go test: `go test ./internal/rclone -run TestName`
- Web checks, in this order: `cd frontend && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` (or just `npm run check`)
- Web build runs `tsc -b` then `vite build`, so it also type-checks. `npm test` runs `*.test.ts` files with Node's built-in runner (Node >= 22.18, no framework); it covers pure logic only, with the `@/` alias and `@/i18n` resolved by `frontend/scripts/alias-loader.mjs`. Keep test-covered modules free of React and DOM imports.
- Desktop dev (GUI mode): `task dev` (wails3 dev, Vite HMR + Go rebuild).
- Browser dev: `task dev:server` (Go API on 8080 + Vite on 1420 in parallel).
- Server mode in Docker (dev): `docker compose -f docker-compose.dev.yml up` — binds 0.0.0.0 with `OURBOROS_TOKEN` (default `ourboros-dev-token`).
- Run the API: `go run ./cmd/ourboros server` (127.0.0.1:8080). Add `--no-auto-rclone` to skip starting rclone.
- Run the UI in dev: `cd frontend && npm run dev` (127.0.0.1:1420). Vite proxies `/api` and `/health` to 8080, so start the API first.
- Serve the built UI from Go: `cd frontend && npm run build`, then `go run ./cmd/ourboros server --webui ./frontend/dist`.
- Desktop: `go run ./cmd/desktop --webui ./frontend/dist`. It needs the `frontend/dist` build and, on macOS, Xcode CLT. Linux needs GTK4 and WebKitGTK 6.0. CI does not build the desktop app.
- Desktop with hot reload: `wails3 dev` (uses `Taskfile.yml` + `build/config.yml`; Vite HMR on port 9245, `.go` changes rebuild and restart the app). `wails3 build DEV=true` builds a dev binary, plain `wails3 build` a production one.
- Format Go with `gofmt -w cmd internal`. Format web with `npm run format`.

## Layout

- `cmd/ourboros`: service entrypoint. `cmd/desktop`: Wails entrypoint plus tray code.
- `internal/serve`: startup wiring. `Run` validates the bind host, resolves the web dir, starts app state and rclone, assembles `service.Services`, then starts the HTTP server.
- `internal/service`: transport-independent application use cases. `Services` is the single entry point for HTTP handlers and the desktop tray; it owns cross-store validation/orchestration and event publication, and must not import `net/http`.
- `internal/httpapi`: transport-only HTTP handlers, SSE, and error mapping. Handlers decode requests and call `internal/service`; they do not hold `app.State` or access domain stores directly. `internal/rclone`: process supervision, RC client, download/discovery. `internal/workspace`: versioned JSON documents (sync tasks live on sync edges), sync-task CRUD in `tasks.go`, and validation. `internal/mounts`, `internal/scheduler`, `internal/jobs`, `internal/settings`, `internal/persist`: supporting state.
- `frontend/src`: React app with react-router, organised by feature.
  - `app/`: `app.tsx` defines the routes; `shell/` holds the layout route (`app-shell.tsx`) with `app-header.tsx` + `sidebar.tsx` around an `<Outlet />`, plus `command-palette.tsx` and `token-gate.tsx` (server-mode token entry); `nav.ts` is the nav registry shared by the sidebar and command palette (grouped workspace/system, paths = routes); `providers/theme-provider.tsx`.
  - `features/<name>/`: one folder per route, each with its `*-page.tsx`. `sync/` (route `/tasks`, 同步任务: `sync-page.tsx`, `sync-store.ts`, `task-form-model.ts`, `labels.ts`, `components/`), `files/` (`/files`, `file-paths.ts`), `storages/` (`/storages`, `storage-store.ts`, `remote-form/`), `overview/` (`/overview`), `settings/` (`/settings`, sub-routes connection/shortcuts/runtime in `sections.tsx`, rclone binary in `binary-section.tsx`), `api-playground/` (`/api`, `endpoints.ts`), `tray/` (the tray panel webview, not a route).
  - `components/common/`: shared building blocks (`select-field`, `switch-field`, `notes`, `status-chip`, `page-header`, `confirm-name-dialog`); `components/ui/` is shadcn-generated. Dialogs are reserved for forms (task dialog, remote form) and dangerous-operation confirmations (`confirm-name-dialog.tsx`).
  - `lib/`: `http/` (`transport.ts` raw fetch + auth header, `sse.ts` EventSource, `client.ts` `call`/`callQuiet` with toasts and error mapping), `format.ts`, `paths.ts`, `platform.ts`, `auth.ts`, `types.ts`. `stores/` keeps only the app-wide `rclone-store.ts`.
  - The i18n locale files are `frontend/src/i18n/locales/{en,zh}.json`.
- `Taskfile.yml` + `build/`: wails3 orchestration. `build/config.yml` drives `wails3 dev` (fixed task names `build`, `run`, `common:dev:frontend` in the root Taskfile); Ourboros uses no Wails bindings, so the template's `generate:bindings` / `go mod tidy` steps are intentionally dropped.
- `docs/dev/` holds the design docs, written in Chinese. `10-设计决策与注意事项.md` lists the rules below in full, and `11-打包和发布指南.md` covers release.

## Constraints that are easy to break

- The server binds loopback without authentication. Non-loopback binds (Docker, NAS) require `--auth-token` / `OURBOROS_TOKEN`; with a token set, every `/api` request must present it (`Authorization: Bearer`, or `?access_token=` for SSE), and foreign `Origin` headers are rejected. This is minimal auth for development exposure — do not treat it as production security; TLS is still missing (`cli.AssertBindHost`).
- RC binds only to 127.0.0.1. Never return RC URLs, RC credentials, remote tokens, or `config/dump` to the browser or the logs.
- Typed API input must validate remote names, relative paths, absolute local paths, operation kind, and sync/mount endpoints.
- Bridge layers (`internal/httpapi`, desktop tray) call use cases through `internal/service`; do not bypass it to manipulate domain stores. The scheduler is a domain consumer and may continue using `Workspace`/`Jobs` directly. `internal/service` stays transport-independent (no `net/http`).
- Dangerous operations (`sync`, `move`, `bisync`, delete, purge, mount) must show source, target, and impact in the UI before running. Two-way sync (bisync) needs an explicit resync confirmation on its first run.
- Workspace and settings JSON carry a schema version and are written atomically. Sync-task writes use revision-based optimistic concurrency, and conflicts return 409.
- rclone may be missing. The service must still start, and rclone-dependent operations return a diagnosable not-ready state. Never overwrite an rclone installed by a system package manager.
- rclone's bandwidth limiter is process-global: `jobs.Store` applies the smallest bwlimit among running tasks via `core/bwlimit` and resets to `off` when none remain. `max_transfer` is per-call through `_config` with `CutoffMode=HARD`.
- An explicit `--webui` path without `index.html` is a startup error. Without the flag, the server runs in API-only mode.
- Mount is remote → local only. Mount options are not passed through from the frontend without platform validation.
- Auto-restore of mounts is off by default. Turning it on needs the startup, PID, and cleanup work described in `docs/dev/10-设计决策与注意事项.md`.
