use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use ourboros::{assert_bind_host, router, AppState, RuntimeConfig};
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

fn test_state() -> (TempDir, AppState) {
    let dir = TempDir::new().expect("tempdir");
    std::fs::create_dir_all(dir.path().join("local")).unwrap();
    let state = AppState::new(RuntimeConfig {
        data_dir: Some(dir.path().to_path_buf()),
        no_auto_rclone: true,
        rclone_bin: Some(dir.path().join("missing-rclone").display().to_string()),
        ..RuntimeConfig::default()
    })
    .expect("state");
    (dir, state)
}

async fn send(app: axum::Router, request: Request<Body>) -> (StatusCode, Value) {
    let response = app.oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let json = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| json!({ "raw": String::from_utf8_lossy(&bytes) }))
    };
    (status, json)
}

#[tokio::test]
async fn health_and_system_info_should_hide_rc_url() {
    let (_dir, state) = test_state();
    let app = router(state);
    let (status, _) = send(
        app.clone(),
        Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = send(
        app,
        Request::builder()
            .uri("/api/system/info")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["name"], "ourboros");
    assert!(body["rclone"].get("rc_url").is_none());
    assert_eq!(body["rclone"]["running"], false);
}

#[tokio::test]
async fn workspace_crud_should_use_revision_and_reject_stale_writes() {
    let (dir, state) = test_state();
    let local = dir.path().join("local");
    let app = router(state);

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .uri("/api/workspace")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["revision"], 0);
    assert_eq!(body["schema_version"], 1);

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/workspace/nodes")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "revision": 0,
                    "kind": "local",
                    "label": "Backups",
                    "position": { "x": 10, "y": 20 },
                    "local_path": local.to_string_lossy(),
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["revision"], 1);
    assert_eq!(body["nodes"][0]["kind"], "local");

    let (status, body) = send(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workspace/nodes")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "revision": 0,
                    "kind": "local",
                    "label": "stale",
                    "position": { "x": 1, "y": 1 },
                    "local_path": local.to_string_lossy(),
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "workspace_conflict");
}

#[tokio::test]
async fn workspace_should_reject_path_traversal_and_illegal_mounts() {
    let (dir, state) = test_state();
    let local = dir.path().join("local");
    let app = router(state);

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/workspace/nodes")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "revision": 0,
                    "kind": "local",
                    "label": "bad",
                    "position": { "x": 0, "y": 0 },
                    "local_path": "../etc/passwd",
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "invalid_path");

    let create_local = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/workspace/nodes")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "revision": 0,
                    "id": "local-1",
                    "kind": "local",
                    "label": "Local",
                    "position": { "x": 0, "y": 0 },
                    "local_path": local.to_string_lossy(),
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(create_local.0, StatusCode::CREATED);

    let create_remote = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/workspace/nodes")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "revision": 1,
                    "id": "remote-1",
                    "kind": "remote",
                    "label": "Archive",
                    "position": { "x": 100, "y": 0 },
                    "remote": { "name": "archive", "path": "ourboros" },
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(create_remote.0, StatusCode::CREATED);

    let (status, body) = send(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workspace/edges")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "revision": 2,
                    "source": "local-1",
                    "target": "remote-1",
                    "kind": "mount",
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"]["message"]
        .as_str()
        .unwrap_or_default()
        .contains("remote source"));
}

#[tokio::test]
async fn rc_proxy_should_reject_sensitive_commands_and_files_should_require_rclone() {
    let (_dir, state) = test_state();
    let app = router(state);

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/rc/config/dump")
            .header("content-type", "application/json")
            .body(Body::from("{}"))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "forbidden_command");

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/rc/sync/copy")
            .header("content-type", "application/json")
            .body(Body::from("{}"))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "forbidden_command");

    let (status, body) = send(
        app,
        Request::builder()
            .uri("/api/files?fs=/tmp&remote=")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["error"]["code"], "rclone_unavailable");
}

#[tokio::test]
async fn settings_json_should_have_schema_version() {
    let (_dir, state) = test_state();
    let app = router(state);
    let (status, body) = send(
        app,
        Request::builder()
            .uri("/api/settings")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["schema_version"], 1);
    assert_eq!(body["auto_start"], true);
}

#[tokio::test]
async fn jobs_and_mounts_should_return_empty_snapshots_without_rclone() {
    let (_dir, state) = test_state();
    let app = router(state);

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .uri("/api/sync/jobs")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["jobs"], json!([]));

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .uri("/api/mounts")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["mounts"], json!([]));

    let (status, body) = send(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/rclone/start")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["error"]["code"], "rclone_unavailable");
}

#[test]
fn assert_bind_host_should_reject_non_loopback() {
    assert!(assert_bind_host("127.0.0.1").is_ok());
    assert!(assert_bind_host("localhost").is_ok());
    assert!(assert_bind_host("0.0.0.0").is_err());
    assert!(assert_bind_host("192.168.1.10").is_err());
}

fn system_rclone() -> Option<String> {
    std::process::Command::new("rclone")
        .arg("version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|_| "rclone".to_string())
}

#[tokio::test]
async fn spawned_rclone_should_serve_allowlisted_commands() {
    let Some(bin) = system_rclone() else {
        return;
    };
    let dir = TempDir::new().expect("tempdir");
    let local = dir.path().join("local");
    std::fs::create_dir_all(&local).unwrap();
    let state = AppState::new(RuntimeConfig {
        data_dir: Some(dir.path().to_path_buf()),
        no_auto_rclone: true,
        rclone_bin: Some(bin),
        ..RuntimeConfig::default()
    })
    .expect("state");

    state.rclone.ensure_running().await.expect("start rclone");
    let app = router(state.clone());

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .uri("/api/rclone/status")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["running"], true);
    assert_eq!(body["mode"], "spawned");
    assert!(body.get("rc_url").is_none());

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/rc/core/version")
            .header("content-type", "application/json")
            .body(Body::from("{}"))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.get("version").is_some());

    let (status, _) = send(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/rc/config/dump")
            .header("content-type", "application/json")
            .body(Body::from("{}"))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, body) = send(
        app.clone(),
        Request::builder()
            .uri(format!("/api/files?fs={}&remote=", local.to_string_lossy()))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body.get("items").is_some());

    state.rclone.stop().await.expect("stop rclone");
}
