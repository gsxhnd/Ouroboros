use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use ourboros_core::{spawn_mount, CoreError, CoreResult, RcloneSupervisor};
use serde::{Deserialize, Serialize};
use tokio::process::Child;
use tokio::sync::{broadcast, Mutex};

use crate::events::AppEvent;
use crate::workspace::{EdgeKind, NodeKind, WorkspaceStore};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MountStatus {
    Starting,
    Mounted,
    Stopping,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountSnapshot {
    pub edge_id: String,
    pub status: MountStatus,
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

struct MountInstance {
    snapshot: MountSnapshot,
    child: Option<Child>,
    _local_path: PathBuf,
}

pub struct MountSupervisor {
    inner: Mutex<HashMap<String, MountInstance>>,
    events: broadcast::Sender<AppEvent>,
}

impl MountSupervisor {
    pub fn new(events: broadcast::Sender<AppEvent>) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            events,
        }
    }

    pub async fn list(&self, workspace: &WorkspaceStore) -> Vec<MountSnapshot> {
        let doc = workspace.get().await;
        let inner = self.inner.lock().await;
        doc.edges
            .iter()
            .filter(|edge| edge.kind == EdgeKind::Mount)
            .map(|edge| {
                inner
                    .get(&edge.id)
                    .map(|instance| instance.snapshot.clone())
                    .unwrap_or_else(|| MountSnapshot {
                        edge_id: edge.id.clone(),
                        status: MountStatus::Stopped,
                        source: edge.source.clone(),
                        target: edge.target.clone(),
                        exit_code: None,
                        error: None,
                    })
            })
            .collect()
    }

    pub async fn is_active(&self, edge_id: &str) -> bool {
        self.inner
            .lock()
            .await
            .get(edge_id)
            .is_some_and(|instance| {
                matches!(
                    instance.snapshot.status,
                    MountStatus::Starting | MountStatus::Mounted | MountStatus::Stopping
                )
            })
    }

    pub async fn start(
        self: &Arc<Self>,
        rclone: &RcloneSupervisor,
        workspace: &WorkspaceStore,
        edge_id: &str,
    ) -> CoreResult<MountSnapshot> {
        let doc = workspace.get().await;
        let edge = doc
            .edge(edge_id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound(format!("edge {edge_id}")))?;
        if edge.kind != EdgeKind::Mount {
            return Err(CoreError::InvalidRequest(format!(
                "edge {edge_id} is not a mount edge"
            )));
        }
        let source_node = doc
            .node(&edge.source)
            .ok_or_else(|| CoreError::NotFound(format!("node {}", edge.source)))?;
        let target_node = doc
            .node(&edge.target)
            .ok_or_else(|| CoreError::NotFound(format!("node {}", edge.target)))?;
        if source_node.kind != NodeKind::Remote || target_node.kind != NodeKind::Local {
            return Err(CoreError::InvalidRequest(
                "mount edges must go from a remote source to a local target".into(),
            ));
        }
        let source = source_node.locator()?;
        let target = target_node.locator()?;
        let local_path = PathBuf::from(&target.fs);

        {
            let inner = self.inner.lock().await;
            if inner.get(edge_id).is_some_and(|instance| {
                matches!(
                    instance.snapshot.status,
                    MountStatus::Starting | MountStatus::Mounted
                )
            }) {
                return Err(CoreError::Conflict(format!(
                    "edge {edge_id} is already mounted"
                )));
            }
        }

        let snapshot = MountSnapshot {
            edge_id: edge_id.to_string(),
            status: MountStatus::Starting,
            source: source.display(),
            target: target.display(),
            exit_code: None,
            error: None,
        };
        {
            let mut inner = self.inner.lock().await;
            inner.insert(
                edge_id.to_string(),
                MountInstance {
                    snapshot: snapshot.clone(),
                    child: None,
                    _local_path: local_path.clone(),
                },
            );
        }
        self.emit(&snapshot);

        let settings = rclone.settings().await;
        match spawn_mount(&settings, &source, &local_path, &[]).await {
            Ok(mut spawned) => {
                tokio::time::sleep(Duration::from_millis(400)).await;
                if let Ok(Some(status)) = spawned.child.try_wait() {
                    let error = drain_stderr(&mut spawned.stderr_rx).await;
                    let failed = MountSnapshot {
                        edge_id: edge_id.to_string(),
                        status: MountStatus::Failed,
                        source: source.display(),
                        target: target.display(),
                        exit_code: status.code(),
                        error: Some(error.unwrap_or_else(|| {
                            format!("rclone mount exited immediately ({status})")
                        })),
                    };
                    {
                        let mut inner = self.inner.lock().await;
                        inner.insert(
                            edge_id.to_string(),
                            MountInstance {
                                snapshot: failed.clone(),
                                child: None,
                                _local_path: local_path,
                            },
                        );
                    }
                    self.emit(&failed);
                    return Ok(failed);
                }

                let mounted = MountSnapshot {
                    status: MountStatus::Mounted,
                    error: None,
                    ..snapshot
                };
                {
                    let mut inner = self.inner.lock().await;
                    inner.insert(
                        edge_id.to_string(),
                        MountInstance {
                            snapshot: mounted.clone(),
                            child: Some(spawned.child),
                            _local_path: local_path,
                        },
                    );
                }
                self.emit(&mounted);
                let supervisor = Arc::clone(self);
                let edge = edge_id.to_string();
                tokio::spawn(async move {
                    supervisor.watch(edge).await;
                });
                Ok(mounted)
            }
            Err(error) => {
                let failed = MountSnapshot {
                    edge_id: edge_id.to_string(),
                    status: MountStatus::Failed,
                    source: source.display(),
                    target: target.display(),
                    exit_code: None,
                    error: Some(error.to_string()),
                };
                {
                    let mut inner = self.inner.lock().await;
                    inner.insert(
                        edge_id.to_string(),
                        MountInstance {
                            snapshot: failed.clone(),
                            child: None,
                            _local_path: local_path,
                        },
                    );
                }
                self.emit(&failed);
                Err(error)
            }
        }
    }

    pub async fn stop(&self, edge_id: &str) -> CoreResult<MountSnapshot> {
        let mut inner = self.inner.lock().await;
        let instance = inner
            .get_mut(edge_id)
            .ok_or_else(|| CoreError::NotFound(format!("mount {edge_id}")))?;
        instance.snapshot.status = MountStatus::Stopping;
        if let Some(mut child) = instance.child.take() {
            let _ = child.start_kill();
            let status = child.wait().await.ok();
            instance.snapshot.status = MountStatus::Stopped;
            instance.snapshot.exit_code = status.and_then(|status| status.code());
            instance.snapshot.error = None;
        } else {
            instance.snapshot.status = MountStatus::Stopped;
        }
        let snapshot = instance.snapshot.clone();
        drop(inner);
        self.emit(&snapshot);
        Ok(snapshot)
    }

    async fn watch(&self, edge_id: String) {
        loop {
            tokio::time::sleep(Duration::from_millis(750)).await;
            let mut inner = self.inner.lock().await;
            let Some(instance) = inner.get_mut(&edge_id) else {
                return;
            };
            if !matches!(instance.snapshot.status, MountStatus::Mounted) {
                return;
            }
            let Some(child) = instance.child.as_mut() else {
                return;
            };
            match child.try_wait() {
                Ok(Some(status)) => {
                    instance.snapshot.status = MountStatus::Failed;
                    instance.snapshot.exit_code = status.code();
                    instance.snapshot.error =
                        Some(format!("rclone mount exited unexpectedly ({status})"));
                    instance.child = None;
                    let snapshot = instance.snapshot.clone();
                    drop(inner);
                    self.emit(&snapshot);
                    return;
                }
                Ok(None) => {}
                Err(error) => {
                    instance.snapshot.status = MountStatus::Failed;
                    instance.snapshot.error = Some(error.to_string());
                    instance.child = None;
                    let snapshot = instance.snapshot.clone();
                    drop(inner);
                    self.emit(&snapshot);
                    return;
                }
            }
        }
    }

    fn emit(&self, snapshot: &MountSnapshot) {
        let _ = self.events.send(AppEvent::Mount(snapshot.clone()));
    }
}

async fn drain_stderr(rx: &mut tokio::sync::mpsc::Receiver<String>) -> Option<String> {
    let mut lines = Vec::new();
    while let Ok(line) = rx.try_recv() {
        lines.push(line);
    }
    if lines.is_empty() {
        None
    } else {
        Some(lines.join("\n"))
    }
}
