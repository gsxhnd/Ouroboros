mod error;

use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use futures_util::Stream;
use ourboros_core::paths::{join_relative, FileLocator};
use ourboros_core::{
    current_release, managed_binary_path, normalize_version, release_for_platform, scan, CoreError,
    DownloadSnapshot, RcloneSourceKind, RcloneStatus,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::events::AppEvent;
use crate::settings::SettingsPatch;
use crate::state::AppState;
use crate::workspace::{
    related_edge_ids, CreateEdgeRequest, CreateNodeRequest, EdgeKind, PatchEdgeRequest,
    PatchNodeRequest, PutWorkspaceRequest, SyncOperation,
};

use error::ApiError;

pub fn router(state: AppState) -> Router {
    let origins = state.cors_origins.clone();
    Router::new()
        .route("/health", get(health))
        .route("/api/system/info", get(system_info))
        .route("/api/rclone/status", get(rclone_status))
        .route("/api/rclone/start", post(rclone_start))
        .route("/api/rclone/stop", post(rclone_stop))
        .route("/api/rclone/scan", post(rclone_scan))
        .route("/api/rclone/select", post(rclone_select))
        .route("/api/rclone/releases", get(rclone_releases))
        .route("/api/rclone/downloads", post(rclone_downloads_start))
        .route(
            "/api/rclone/downloads/{id}/events",
            get(rclone_download_events),
        )
        .route(
            "/api/rclone/downloads/{id}/cancel",
            post(rclone_download_cancel),
        )
        .route(
            "/api/rclone/versions/{version}/activate",
            post(rclone_version_activate),
        )
        .route(
            "/api/rclone/versions/{version}",
            delete(rclone_version_delete),
        )
        .route("/api/workspace", get(workspace_get).put(workspace_put))
        .route("/api/workspace/nodes", post(workspace_create_node))
        .route(
            "/api/workspace/nodes/{id}",
            patch(workspace_patch_node).delete(workspace_delete_node),
        )
        .route("/api/workspace/edges", post(workspace_create_edge))
        .route(
            "/api/workspace/edges/{id}",
            patch(workspace_patch_edge).delete(workspace_delete_edge),
        )
        .route("/api/remotes", get(remotes_list).post(remotes_create))
        .route("/api/remotes/{name}", patch(remotes_update))
        .route("/api/files", get(files_list).delete(files_delete))
        .route("/api/files/mkdir", post(files_mkdir))
        .route("/api/files/copy", post(files_copy))
        .route("/api/files/move", post(files_move))
        .route("/api/sync/{edge_id}/run", post(sync_run))
        .route("/api/sync/jobs", get(sync_jobs))
        .route("/api/sync/jobs/events", get(sync_job_events))
        .route("/api/sync/jobs/{job_id}/stop", post(sync_job_stop))
        .route("/api/mounts", get(mounts_list))
        .route("/api/mounts/events", get(mount_events))
        .route("/api/mounts/{edge_id}/start", post(mount_start))
        .route("/api/mounts/{edge_id}/stop", post(mount_stop))
        .route("/api/settings", get(settings_get).patch(settings_patch))
        .route("/api/rc/{*command}", post(proxy_rc))
        .with_state(state)
        .layer(cors_layer(origins))
        .layer(TraceLayer::new_for_http())
}

fn cors_layer(origins: Vec<HeaderValue>) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT])
}

async fn health() -> &'static str {
    "ok"
}

async fn system_info(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "name": "ourboros",
        "version": state.version,
        "home_dir": state.home_dir,
        "rclone": state.rclone.status().await,
    }))
}

async fn rclone_status(State(state): State<AppState>) -> Json<RcloneStatus> {
    Json(state.rclone.status().await)
}

async fn rclone_start(State(state): State<AppState>) -> Result<Json<RcloneStatus>, ApiError> {
    Ok(Json(state.rclone.ensure_running().await?))
}

async fn rclone_stop(State(state): State<AppState>) -> Result<Json<RcloneStatus>, ApiError> {
    Ok(Json(state.rclone.stop().await?))
}

async fn rclone_scan(State(state): State<AppState>) -> Json<Value> {
    let settings = state.settings.get();
    let custom = settings
        .rclone_bin
        .as_ref()
        .map(PathBuf::from)
        .filter(|path| path.is_absolute() || path.exists());
    let candidates = scan(custom.as_deref(), Some(&state.versions_dir())).await;
    Json(json!({ "candidates": candidates }))
}

#[derive(Deserialize)]
struct SelectRcloneRequest {
    source: RcloneSourceKind,
    path: Option<String>,
    version: Option<String>,
}

async fn rclone_select(
    State(state): State<AppState>,
    Json(body): Json<SelectRcloneRequest>,
) -> Result<Json<RcloneStatus>, ApiError> {
    let path = match body.source {
        RcloneSourceKind::Managed => {
            let version = body.version.ok_or_else(|| {
                ApiError::bad_request("invalid_request", "managed source requires version")
            })?;
            managed_binary_path(&state.versions_dir(), &normalize_version(&version))
                .display()
                .to_string()
        }
        RcloneSourceKind::Custom | RcloneSourceKind::System => body.path.ok_or_else(|| {
            ApiError::bad_request("invalid_request", "source requires an executable path")
        })?,
    };
    if !std::path::Path::new(&path).exists() {
        return Err(ApiError::from_core(CoreError::BinaryNotFound(path)));
    }
    state
        .rclone
        .update_settings(|settings| {
            settings.bin = path.clone();
        })
        .await;
    let _ = state.settings.patch(SettingsPatch {
        rclone_source: Some(body.source),
        rclone_bin: Some(Some(path)),
        ..SettingsPatch::default()
    });
    Ok(Json(state.rclone.status().await))
}

async fn rclone_releases() -> Result<Json<Value>, ApiError> {
    let client = ourboros_core::rclone::RcClient::new();
    let current = current_release(&client).await?;
    let this_platform = release_for_platform(&current.version)?;
    Ok(Json(json!({
        "current": current.version,
        "releases": [this_platform],
    })))
}

#[derive(Deserialize)]
struct StartDownloadRequest {
    version: String,
}

async fn rclone_downloads_start(
    State(state): State<AppState>,
    Json(body): Json<StartDownloadRequest>,
) -> Result<Json<DownloadSnapshot>, ApiError> {
    let events = state.events.clone();
    let snapshot = state
        .downloads
        .start(&body.version, state.versions_dir(), move |snapshot| {
            let _ = events.send(AppEvent::Download(snapshot));
        })
        .await?;
    Ok(Json(snapshot))
}

async fn rclone_download_events(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    event_stream(state.events.subscribe(), move |event| match event {
        AppEvent::Download(snapshot) => snapshot.id == id,
        _ => false,
    })
}

async fn rclone_download_cancel(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<DownloadSnapshot>, ApiError> {
    Ok(Json(state.downloads.cancel(&id).await?))
}

async fn rclone_version_activate(
    State(state): State<AppState>,
    Path(version): Path<String>,
) -> Result<Json<RcloneStatus>, ApiError> {
    let version = normalize_version(&version);
    let path = managed_binary_path(&state.versions_dir(), &version);
    if !path.is_file() {
        return Err(ApiError::not_found(format!("managed rclone {version}")));
    }
    let path = path.display().to_string();
    state
        .rclone
        .update_settings(|settings| {
            settings.bin = path.clone();
        })
        .await;
    let _ = state.settings.patch(SettingsPatch {
        rclone_source: Some(RcloneSourceKind::Managed),
        rclone_bin: Some(Some(path)),
        ..SettingsPatch::default()
    });
    Ok(Json(state.rclone.status().await))
}

async fn rclone_version_delete(
    State(state): State<AppState>,
    Path(version): Path<String>,
) -> Result<StatusCode, ApiError> {
    let version = normalize_version(&version);
    let dir = state.versions_dir().join(&version);
    if !dir.exists() {
        return Err(ApiError::not_found(format!("managed rclone {version}")));
    }
    let current = state.rclone.selected_bin().await;
    let managed = managed_binary_path(&state.versions_dir(), &version);
    std::fs::remove_dir_all(&dir).map_err(CoreError::from)?;
    if current == managed.display().to_string() {
        state
            .rclone
            .update_settings(|settings| {
                settings.bin = "rclone".into();
            })
            .await;
        let _ = state.settings.patch(SettingsPatch {
            rclone_source: Some(RcloneSourceKind::System),
            rclone_bin: Some(None),
            ..SettingsPatch::default()
        });
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn workspace_get(State(state): State<AppState>) -> Json<Value> {
    Json(json!(state.workspace.get().await))
}

async fn workspace_put(
    State(state): State<AppState>,
    Json(body): Json<PutWorkspaceRequest>,
) -> Result<Json<Value>, ApiError> {
    let remotes = remotes_if_ready(&state).await?;
    let doc = state.workspace.replace(body, remotes.as_deref()).await?;
    Ok(Json(json!(doc)))
}

async fn workspace_create_node(
    State(state): State<AppState>,
    Json(body): Json<CreateNodeRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let remotes = remotes_if_ready(&state).await?;
    let doc = state
        .workspace
        .create_node(body, remotes.as_deref())
        .await?;
    Ok((StatusCode::CREATED, Json(json!(doc))))
}

async fn workspace_patch_node(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<PatchNodeRequest>,
) -> Result<Json<Value>, ApiError> {
    let remotes = remotes_if_ready(&state).await?;
    let doc = state
        .workspace
        .patch_node(&id, body, remotes.as_deref())
        .await?;
    Ok(Json(json!(doc)))
}

async fn workspace_delete_node(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<Value>, ApiError> {
    ensure_idle(&state, &related_edge_ids(&state.workspace.get().await, &id)).await?;
    let remotes = remotes_if_ready(&state).await?;
    let doc = state
        .workspace
        .delete_node(&id, query.revision, remotes.as_deref())
        .await?;
    Ok(Json(json!(doc)))
}

async fn workspace_create_edge(
    State(state): State<AppState>,
    Json(body): Json<CreateEdgeRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let remotes = remotes_if_ready(&state).await?;
    let doc = state
        .workspace
        .create_edge(body, remotes.as_deref())
        .await?;
    Ok((StatusCode::CREATED, Json(json!(doc))))
}

async fn workspace_patch_edge(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<PatchEdgeRequest>,
) -> Result<Json<Value>, ApiError> {
    let remotes = remotes_if_ready(&state).await?;
    let doc = state
        .workspace
        .patch_edge(&id, body, remotes.as_deref())
        .await?;
    Ok(Json(json!(doc)))
}

async fn workspace_delete_edge(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<Value>, ApiError> {
    ensure_idle(&state, std::slice::from_ref(&id)).await?;
    let remotes = remotes_if_ready(&state).await?;
    let doc = state
        .workspace
        .delete_edge(&id, query.revision, remotes.as_deref())
        .await?;
    Ok(Json(json!(doc)))
}

async fn remotes_list(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let remotes = state.rclone.list_remotes().await?;
    Ok(Json(json!({
        "remotes": remotes.into_iter().map(|name| json!({ "name": name })).collect::<Vec<_>>()
    })))
}

#[derive(Deserialize)]
struct UpsertRemoteRequest {
    name: Option<String>,
    #[serde(rename = "type")]
    type_name: Option<String>,
    #[serde(default)]
    parameters: Value,
}

async fn remotes_create(
    State(state): State<AppState>,
    Json(body): Json<UpsertRemoteRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let name = body
        .name
        .ok_or_else(|| ApiError::bad_request("invalid_request", "remote name is required"))?;
    let type_name = body
        .type_name
        .ok_or_else(|| ApiError::bad_request("invalid_request", "remote type is required"))?;
    let response = state
        .rclone
        .call_internal(
            "config/create",
            json!({
                "name": name,
                "type": type_name,
                "parameters": body.parameters,
                "opt": { "nonInteractive": true, "obscure": true }
            }),
        )
        .await?;
    map_upstream(response.status, &response.body)?;
    Ok((StatusCode::CREATED, Json(json!({ "name": name }))))
}

async fn remotes_update(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(body): Json<UpsertRemoteRequest>,
) -> Result<Json<Value>, ApiError> {
    let response = state
        .rclone
        .call_internal(
            "config/update",
            json!({
                "name": name,
                "parameters": body.parameters,
                "opt": { "nonInteractive": true, "obscure": true }
            }),
        )
        .await?;
    map_upstream(response.status, &response.body)?;
    Ok(Json(json!({ "name": name })))
}

#[derive(Deserialize)]
struct FileQuery {
    fs: String,
    remote: Option<String>,
    path: Option<String>,
    purge: Option<bool>,
}

impl FileQuery {
    fn locator(&self, home: Option<&std::path::Path>) -> Result<FileLocator, ApiError> {
        locator_from_parts(&self.fs, self.remote.as_deref(), self.path.as_deref(), home)
    }
}

async fn files_list(
    State(state): State<AppState>,
    Query(query): Query<FileQuery>,
) -> Result<Json<Value>, ApiError> {
    let locator = query.locator(state.home_dir.as_deref())?;
    let response = state
        .rclone
        .call_internal(
            "operations/list",
            json!({
                "fs": locator.rclone_fs(),
                "remote": locator.rclone_remote(),
            }),
        )
        .await?;
    map_upstream(response.status, &response.body)?;
    let items = response
        .body
        .get("list")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(map_list_item)
        .collect::<Vec<_>>();
    Ok(Json(json!({
        "fs": locator.fs,
        "remote": locator.remote,
        "items": items,
    })))
}

#[derive(Deserialize)]
struct MkdirRequest {
    fs: String,
    remote: Option<String>,
    path: Option<String>,
}

async fn files_mkdir(
    State(state): State<AppState>,
    Json(body): Json<MkdirRequest>,
) -> Result<Json<Value>, ApiError> {
    let locator = locator_from_parts(
        &body.fs,
        body.remote.as_deref(),
        body.path.as_deref(),
        state.home_dir.as_deref(),
    )?;
    let response = state
        .rclone
        .call_internal(
            "operations/mkdir",
            json!({
                "fs": locator.rclone_fs(),
                "remote": locator.rclone_remote(),
            }),
        )
        .await?;
    map_upstream(response.status, &response.body)?;
    Ok(Json(json!({
        "fs": locator.fs,
        "remote": locator.remote,
        "destructive": false,
        "impact": format!("Create directory {}", locator.display()),
    })))
}

#[derive(Deserialize)]
struct TransferRequest {
    src_fs: String,
    src_remote: Option<String>,
    src_path: Option<String>,
    dst_fs: String,
    dst_remote: Option<String>,
    dst_path: Option<String>,
    directory: Option<bool>,
}

async fn files_copy(
    State(state): State<AppState>,
    Json(body): Json<TransferRequest>,
) -> Result<Json<Value>, ApiError> {
    transfer_files(&state, body, false).await
}

async fn files_move(
    State(state): State<AppState>,
    Json(body): Json<TransferRequest>,
) -> Result<Json<Value>, ApiError> {
    transfer_files(&state, body, true).await
}

async fn files_delete(
    State(state): State<AppState>,
    Query(query): Query<FileQuery>,
) -> Result<Json<Value>, ApiError> {
    let locator = query.locator(state.home_dir.as_deref())?;
    let purge = query.purge.unwrap_or(false);
    let command = if purge {
        "operations/purge"
    } else {
        "operations/deletefile"
    };
    let response = state
        .rclone
        .call_internal(
            command,
            json!({
                "fs": locator.rclone_fs(),
                "remote": locator.rclone_remote(),
            }),
        )
        .await?;
    map_upstream(response.status, &response.body)?;
    Ok(Json(json!({
        "fs": locator.fs,
        "remote": locator.remote,
        "destructive": true,
        "source": locator,
        "impact": if purge {
            format!("Permanently delete {} and all of its contents.", locator.display())
        } else {
            format!("Delete file {}.", locator.display())
        }
    })))
}

async fn sync_run(
    State(state): State<AppState>,
    Path(edge_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let doc = state.workspace.get().await;
    let edge = doc
        .edge(&edge_id)
        .cloned()
        .ok_or_else(|| ApiError::not_found(format!("edge {edge_id}")))?;
    if edge.kind != EdgeKind::Sync {
        return Err(ApiError::bad_request(
            "invalid_request",
            "only sync edges can be run",
        ));
    }
    let sync = edge.sync.ok_or_else(|| {
        ApiError::bad_request("invalid_request", "sync edge is missing configuration")
    })?;
    if !sync.enabled {
        return Err(ApiError::conflict("conflict", "sync edge is disabled"));
    }
    let source = doc.node_locator(&edge.source)?;
    let target = doc.node_locator(&edge.target)?;
    let snapshot = state
        .jobs
        .start(
            Arc::clone(&state.rclone),
            Arc::clone(&state.workspace),
            &edge_id,
            sync.operation,
            source,
            target,
        )
        .await?;
    Ok(Json(json!(snapshot)))
}

async fn sync_jobs(State(state): State<AppState>) -> Json<Value> {
    Json(json!({ "jobs": state.jobs.list().await }))
}

async fn sync_job_events(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    event_stream(state.events.subscribe(), |event| {
        matches!(event, AppEvent::Job(_))
    })
}

async fn sync_job_stop(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let snapshot = state.jobs.stop(&state.rclone, &job_id).await?;
    Ok(Json(json!(snapshot)))
}

async fn mounts_list(State(state): State<AppState>) -> Json<Value> {
    Json(json!({ "mounts": state.mounts.list(&state.workspace).await }))
}

async fn mount_events(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    event_stream(state.events.subscribe(), |event| {
        matches!(event, AppEvent::Mount(_))
    })
}

async fn mount_start(
    State(state): State<AppState>,
    Path(edge_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let snapshot = state
        .mounts
        .start(&state.rclone, &state.workspace, &edge_id)
        .await?;
    Ok(Json(json!(snapshot)))
}

async fn mount_stop(
    State(state): State<AppState>,
    Path(edge_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let snapshot = state.mounts.stop(&edge_id).await?;
    Ok(Json(json!(snapshot)))
}

async fn settings_get(State(state): State<AppState>) -> Json<Value> {
    Json(json!(state.settings.get()))
}

async fn settings_patch(
    State(state): State<AppState>,
    Json(body): Json<SettingsPatch>,
) -> Result<Json<Value>, ApiError> {
    if state.cli_bin_override && body.rclone_bin.is_some() {
        return Err(ApiError::conflict(
            "conflict",
            "rclone binary is overridden by CLI for this process",
        ));
    }
    if state.cli_config_override && body.rclone_config.is_some() {
        return Err(ApiError::conflict(
            "conflict",
            "rclone config is overridden by CLI for this process",
        ));
    }
    let document = state.settings.patch(body)?;
    if !state.cli_bin_override {
        if let Some(bin) = &document.rclone_bin {
            let bin = bin.clone();
            state
                .rclone
                .update_settings(|settings| {
                    settings.bin = bin;
                })
                .await;
        }
    }
    if !state.cli_config_override {
        let config = document.rclone_config.clone();
        state
            .rclone
            .update_settings(|settings| {
                settings.config = config;
            })
            .await;
    }
    Ok(Json(json!(document)))
}

async fn proxy_rc(
    State(state): State<AppState>,
    Path(command): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    let payload = if body.is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_slice(&body)
            .map_err(|error| ApiError::bad_request("invalid_request", error.to_string()))?
    };
    let response = state.rclone.call_allowed(&command, payload).await?;
    let status = StatusCode::from_u16(response.status).unwrap_or(StatusCode::BAD_GATEWAY);
    Ok((status, Json(response.body)).into_response())
}

#[derive(Deserialize)]
struct RevisionQuery {
    revision: u64,
}

async fn remotes_if_ready(state: &AppState) -> Result<Option<Vec<String>>, ApiError> {
    match state.rclone.list_remotes().await {
        Ok(list) => Ok(Some(list)),
        Err(CoreError::NotRunning) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

async fn ensure_idle(state: &AppState, edge_ids: &[String]) -> Result<(), ApiError> {
    for edge_id in edge_ids {
        if state.jobs.is_running(edge_id).await {
            return Err(ApiError::conflict(
                "job_conflict",
                format!("edge {edge_id} has a running job"),
            ));
        }
        if state.mounts.is_active(edge_id).await {
            return Err(ApiError::conflict(
                "mount_conflict",
                format!("edge {edge_id} has an active mount"),
            ));
        }
    }
    Ok(())
}

fn locator_from_parts(
    fs: &str,
    remote: Option<&str>,
    path: Option<&str>,
    home: Option<&std::path::Path>,
) -> Result<FileLocator, ApiError> {
    let relative = match (remote, path) {
        (Some(remote), Some(path)) if remote != path => join_relative(remote, path)?,
        (Some(remote), _) => remote.to_string(),
        (None, Some(path)) => path.to_string(),
        _ => String::new(),
    };
    Ok(FileLocator::parse(fs, &relative, home)?)
}

async fn transfer_files(
    state: &AppState,
    body: TransferRequest,
    r#move: bool,
) -> Result<Json<Value>, ApiError> {
    let source = locator_from_parts(
        &body.src_fs,
        body.src_remote.as_deref(),
        body.src_path.as_deref(),
        state.home_dir.as_deref(),
    )?;
    let target = locator_from_parts(
        &body.dst_fs,
        body.dst_remote.as_deref(),
        body.dst_path.as_deref(),
        state.home_dir.as_deref(),
    )?;
    let directory = body.directory.unwrap_or(false);
    let (command, payload) = if directory {
        (
            if r#move { "sync/move" } else { "sync/copy" },
            json!({
                "srcFs": source.combined_fs(),
                "dstFs": target.combined_fs(),
            }),
        )
    } else if r#move {
        (
            "operations/movefile",
            json!({
                "srcFs": source.rclone_fs(),
                "srcRemote": source.rclone_remote(),
                "dstFs": target.rclone_fs(),
                "dstRemote": target.rclone_remote(),
            }),
        )
    } else {
        (
            "operations/copyfile",
            json!({
                "srcFs": source.rclone_fs(),
                "srcRemote": source.rclone_remote(),
                "dstFs": target.rclone_fs(),
                "dstRemote": target.rclone_remote(),
            }),
        )
    };
    let response = state.rclone.call_internal(command, payload).await?;
    map_upstream(response.status, &response.body)?;
    let impact = if r#move {
        SyncOperation::Move.impact(&source.display(), &target.display())
    } else {
        SyncOperation::Copy.impact(&source.display(), &target.display())
    };
    Ok(Json(json!({
        "destructive": r#move,
        "source": source,
        "target": target,
        "impact": impact,
    })))
}

fn map_list_item(item: Value) -> Value {
    json!({
        "name": item.get("Name"),
        "path": item.get("Path"),
        "size": item.get("Size"),
        "mime_type": item.get("MimeType"),
        "mod_time": item.get("ModTime"),
        "is_dir": item.get("IsDir"),
    })
}

fn map_upstream(status: u16, body: &Value) -> Result<(), ApiError> {
    if (200..300).contains(&status) {
        return Ok(());
    }
    let message = body
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or("rclone operation failed");
    Err(ApiError::new(
        StatusCode::BAD_GATEWAY,
        "rclone_error",
        message,
        json!({ "status": status }),
    ))
}

fn event_stream(
    rx: tokio::sync::broadcast::Receiver<AppEvent>,
    want: impl Fn(&AppEvent) -> bool + Send + 'static,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = BroadcastStream::new(rx).filter_map(move |item| {
        let Ok(event) = item else {
            return None;
        };
        if !want(&event) {
            return None;
        }
        Event::default()
            .event(event.name())
            .json_data(&event)
            .ok()
            .map(Ok)
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
