use std::collections::HashSet;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use ourboros_core::paths::{validate_local_path, validate_relative_path, validate_remote_name};
use ourboros_core::{home_dir, CoreError, CoreResult, FileLocator};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::persist::{atomic_write_json, read_json_bytes};

pub const WORKSPACE_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDocument {
    pub schema_version: u32,
    pub revision: u64,
    pub nodes: Vec<StorageNode>,
    pub edges: Vec<ConnectionEdge>,
    pub viewport: Viewport,
    pub updated_at: DateTime<Utc>,
}

impl WorkspaceDocument {
    pub fn empty() -> Self {
        Self {
            schema_version: WORKSPACE_SCHEMA_VERSION,
            revision: 0,
            nodes: Vec::new(),
            edges: Vec::new(),
            viewport: Viewport::default(),
            updated_at: Utc::now(),
        }
    }

    pub fn node(&self, id: &str) -> Option<&StorageNode> {
        self.nodes.iter().find(|node| node.id == id)
    }

    pub fn edge(&self, id: &str) -> Option<&ConnectionEdge> {
        self.edges.iter().find(|edge| edge.id == id)
    }

    pub fn node_locator(&self, id: &str) -> CoreResult<FileLocator> {
        let node = self
            .node(id)
            .ok_or_else(|| CoreError::NotFound(format!("node {id}")))?;
        node.locator()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageNode {
    pub id: String,
    pub kind: NodeKind,
    pub label: String,
    pub position: Position,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote: Option<RemoteRef>,
}

impl StorageNode {
    pub fn locator(&self) -> CoreResult<FileLocator> {
        match self.kind {
            NodeKind::Local => {
                let path = self.local_path.as_deref().ok_or_else(|| {
                    CoreError::InvalidPath(format!("local node {} is missing local_path", self.id))
                })?;
                FileLocator::parse(path, "", home_dir().as_deref())
            }
            NodeKind::Remote => {
                let remote = self.remote.as_ref().ok_or_else(|| {
                    CoreError::InvalidPath(format!("remote node {} is missing remote", self.id))
                })?;
                FileLocator::parse(&remote.name, &remote.path, home_dir().as_deref())
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteRef {
    pub name: String,
    #[serde(default)]
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

impl Default for Viewport {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub kind: EdgeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync: Option<SyncConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mount: Option<MountConfig>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeKind {
    Sync,
    Mount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub operation: SyncOperation,
    pub schedule: ScheduleConfig,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_run: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_result: Option<LastResult>,
}

impl SyncConfig {
    pub fn default_for(operation: SyncOperation) -> Self {
        Self {
            operation,
            schedule: ScheduleConfig::disabled(),
            enabled: true,
            next_run: None,
            last_result: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncOperation {
    Copy,
    Move,
    Sync,
}

impl SyncOperation {
    pub fn rclone_command(self) -> &'static str {
        match self {
            Self::Copy => "sync/copy",
            Self::Move => "sync/move",
            Self::Sync => "sync/sync",
        }
    }

    pub fn is_destructive(self) -> bool {
        matches!(self, Self::Move | Self::Sync)
    }

    pub fn impact(self, source: &str, target: &str) -> String {
        match self {
            Self::Copy => format!("Copy files from {source} to {target}. Source is unchanged."),
            Self::Move => {
                format!(
                    "Move files from {source} to {target}. Files will be removed from the source."
                )
            }
            Self::Sync => {
                format!("Sync {source} to {target}. Extra files on the destination may be deleted.")
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    pub mode: ScheduleMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<SchedulePreset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default)]
    pub enabled: bool,
}

impl ScheduleConfig {
    pub fn disabled() -> Self {
        Self {
            mode: ScheduleMode::Preset,
            preset: Some(SchedulePreset::Daily),
            cron: None,
            timezone: default_timezone(),
            enabled: false,
        }
    }
}

fn default_timezone() -> String {
    "UTC".into()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScheduleMode {
    Preset,
    Cron,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SchedulePreset {
    Hourly,
    Daily,
    Weekly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastResult {
    pub job_id: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountConfig {
    #[serde(default)]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateNodeRequest {
    pub revision: u64,
    pub id: Option<String>,
    pub kind: NodeKind,
    pub label: String,
    pub position: Position,
    pub local_path: Option<String>,
    pub remote: Option<RemoteRef>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PatchNodeRequest {
    pub revision: u64,
    pub label: Option<String>,
    pub position: Option<Position>,
    pub local_path: Option<String>,
    pub remote: Option<RemoteRef>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateEdgeRequest {
    pub revision: u64,
    pub id: Option<String>,
    pub source: String,
    pub target: String,
    pub kind: EdgeKind,
    pub operation: Option<SyncOperation>,
    pub schedule: Option<ScheduleConfig>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PatchEdgeRequest {
    pub revision: u64,
    pub operation: Option<SyncOperation>,
    pub schedule: Option<ScheduleConfig>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PutWorkspaceRequest {
    pub revision: u64,
    pub nodes: Vec<StorageNode>,
    pub edges: Vec<ConnectionEdge>,
    pub viewport: Viewport,
}

pub struct WorkspaceStore {
    path: PathBuf,
    inner: Mutex<WorkspaceDocument>,
}

impl WorkspaceStore {
    pub fn load_or_create(path: PathBuf) -> CoreResult<Self> {
        let document = if path.exists() {
            load_workspace(&path)?
        } else {
            let document = WorkspaceDocument::empty();
            atomic_write_json(&path, &document)?;
            document
        };
        Ok(Self {
            path,
            inner: Mutex::new(document),
        })
    }

    pub async fn get(&self) -> WorkspaceDocument {
        self.inner.lock().await.clone()
    }

    pub async fn replace(
        &self,
        request: PutWorkspaceRequest,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(request.revision, remotes, |doc| {
            doc.nodes = request.nodes;
            doc.edges = request.edges;
            doc.viewport = request.viewport;
            Ok(())
        })
        .await
    }

    pub async fn create_node(
        &self,
        request: CreateNodeRequest,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(request.revision, remotes, |doc| {
            let node = StorageNode {
                id: request.id.unwrap_or_else(|| Uuid::new_v4().to_string()),
                kind: request.kind,
                label: request.label,
                position: request.position,
                local_path: request.local_path,
                remote: request.remote,
            };
            if doc.node(&node.id).is_some() {
                return Err(CoreError::Conflict(format!(
                    "node {} already exists",
                    node.id
                )));
            }
            doc.nodes.push(node);
            Ok(())
        })
        .await
    }

    pub async fn patch_node(
        &self,
        id: &str,
        request: PatchNodeRequest,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(request.revision, remotes, |doc| {
            let node = doc
                .nodes
                .iter_mut()
                .find(|node| node.id == id)
                .ok_or_else(|| CoreError::NotFound(format!("node {id}")))?;
            if let Some(label) = request.label {
                node.label = label;
            }
            if let Some(position) = request.position {
                node.position = position;
            }
            if let Some(local_path) = request.local_path {
                node.local_path = Some(local_path);
            }
            if let Some(remote) = request.remote {
                node.remote = Some(remote);
            }
            Ok(())
        })
        .await
    }

    pub async fn delete_node(
        &self,
        id: &str,
        revision: u64,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(revision, remotes, |doc| {
            let exists = doc.nodes.iter().any(|node| node.id == id);
            if !exists {
                return Err(CoreError::NotFound(format!("node {id}")));
            }
            doc.nodes.retain(|node| node.id != id);
            doc.edges
                .retain(|edge| edge.source != id && edge.target != id);
            Ok(())
        })
        .await
    }

    pub async fn create_edge(
        &self,
        request: CreateEdgeRequest,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(request.revision, remotes, |doc| {
            let edge = ConnectionEdge {
                id: request.id.unwrap_or_else(|| Uuid::new_v4().to_string()),
                source: request.source,
                target: request.target,
                kind: request.kind,
                sync: match request.kind {
                    EdgeKind::Sync => Some({
                        let mut config = SyncConfig::default_for(
                            request.operation.unwrap_or(SyncOperation::Copy),
                        );
                        if let Some(schedule) = request.schedule {
                            config.schedule = schedule;
                        }
                        if let Some(enabled) = request.enabled {
                            config.enabled = enabled;
                        }
                        config
                    }),
                    EdgeKind::Mount => None,
                },
                mount: match request.kind {
                    EdgeKind::Mount => Some(MountConfig {
                        enabled: request.enabled.unwrap_or(true),
                    }),
                    EdgeKind::Sync => None,
                },
            };
            if doc.edge(&edge.id).is_some() {
                return Err(CoreError::Conflict(format!(
                    "edge {} already exists",
                    edge.id
                )));
            }
            doc.edges.push(edge);
            Ok(())
        })
        .await
    }

    pub async fn patch_edge(
        &self,
        id: &str,
        request: PatchEdgeRequest,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(request.revision, remotes, |doc| {
            let edge = doc
                .edges
                .iter_mut()
                .find(|edge| edge.id == id)
                .ok_or_else(|| CoreError::NotFound(format!("edge {id}")))?;
            match edge.kind {
                EdgeKind::Sync => {
                    let config = edge
                        .sync
                        .get_or_insert_with(|| SyncConfig::default_for(SyncOperation::Copy));
                    if let Some(operation) = request.operation {
                        config.operation = operation;
                    }
                    if let Some(schedule) = request.schedule {
                        config.schedule = schedule;
                    }
                    if let Some(enabled) = request.enabled {
                        config.enabled = enabled;
                    }
                }
                EdgeKind::Mount => {
                    if request.operation.is_some() || request.schedule.is_some() {
                        return Err(CoreError::InvalidRequest(
                            "mount edges do not accept sync operation or schedule".into(),
                        ));
                    }
                    if let Some(enabled) = request.enabled {
                        edge.mount = Some(MountConfig { enabled });
                    }
                }
            }
            Ok(())
        })
        .await
    }

    pub async fn delete_edge(
        &self,
        id: &str,
        revision: u64,
        remotes: Option<&[String]>,
    ) -> CoreResult<WorkspaceDocument> {
        self.mutate(revision, remotes, |doc| {
            let exists = doc.edges.iter().any(|edge| edge.id == id);
            if !exists {
                return Err(CoreError::NotFound(format!("edge {id}")));
            }
            doc.edges.retain(|edge| edge.id != id);
            Ok(())
        })
        .await
    }

    pub async fn record_job_result(
        &self,
        edge_id: &str,
        result: LastResult,
        next_run: Option<DateTime<Utc>>,
    ) -> CoreResult<WorkspaceDocument> {
        let mut guard = self.inner.lock().await;
        let Some(edge) = guard.edges.iter_mut().find(|edge| edge.id == edge_id) else {
            return Ok(guard.clone());
        };
        if let Some(sync) = edge.sync.as_mut() {
            sync.last_result = Some(result);
            if next_run.is_some() {
                sync.next_run = next_run;
            }
            guard.revision += 1;
            guard.updated_at = Utc::now();
            atomic_write_json(&self.path, &*guard)?;
        }
        Ok(guard.clone())
    }

    pub async fn set_next_run(
        &self,
        edge_id: &str,
        next_run: Option<DateTime<Utc>>,
    ) -> CoreResult<()> {
        let mut guard = self.inner.lock().await;
        if let Some(edge) = guard.edges.iter_mut().find(|edge| edge.id == edge_id) {
            if let Some(sync) = edge.sync.as_mut() {
                sync.next_run = next_run;
                guard.updated_at = Utc::now();
                atomic_write_json(&self.path, &*guard)?;
            }
        }
        Ok(())
    }

    async fn mutate(
        &self,
        expected: u64,
        remotes: Option<&[String]>,
        mutate: impl FnOnce(&mut WorkspaceDocument) -> CoreResult<()>,
    ) -> CoreResult<WorkspaceDocument> {
        let mut guard = self.inner.lock().await;
        if guard.revision != expected {
            return Err(CoreError::Conflict(format!(
                "workspace revision is stale: expected {}, found {}",
                expected, guard.revision
            )));
        }
        let mut next = guard.clone();
        mutate(&mut next)?;
        validate_workspace(&next, remotes, home_dir().as_deref())?;
        next.revision += 1;
        next.updated_at = Utc::now();
        atomic_write_json(&self.path, &next)?;
        *guard = next;
        Ok(guard.clone())
    }
}

pub fn validate_workspace(
    doc: &WorkspaceDocument,
    remotes: Option<&[String]>,
    home: Option<&Path>,
) -> CoreResult<()> {
    let mut node_ids = HashSet::new();
    for node in &doc.nodes {
        if !node_ids.insert(node.id.clone()) {
            return Err(CoreError::InvalidRequest(format!(
                "duplicate node id {}",
                node.id
            )));
        }
        validate_node(node, remotes, home)?;
    }

    let mut edge_ids = HashSet::new();
    let mut pairs = HashSet::new();
    for edge in &doc.edges {
        if !edge_ids.insert(edge.id.clone()) {
            return Err(CoreError::InvalidRequest(format!(
                "duplicate edge id {}",
                edge.id
            )));
        }
        if !pairs.insert((edge.source.clone(), edge.target.clone())) {
            return Err(CoreError::InvalidRequest(format!(
                "duplicate edge from {} to {}",
                edge.source, edge.target
            )));
        }
        let source = doc.node(&edge.source).ok_or_else(|| {
            CoreError::InvalidRequest(format!("edge {} references missing source", edge.id))
        })?;
        let target = doc.node(&edge.target).ok_or_else(|| {
            CoreError::InvalidRequest(format!("edge {} references missing target", edge.id))
        })?;
        match edge.kind {
            EdgeKind::Mount => {
                if source.kind != NodeKind::Remote || target.kind != NodeKind::Local {
                    return Err(CoreError::InvalidRequest(
                        "mount edges must go from a remote source to a local target".into(),
                    ));
                }
            }
            EdgeKind::Sync => {
                if edge.sync.is_none() {
                    return Err(CoreError::InvalidRequest(format!(
                        "sync edge {} is missing sync configuration",
                        edge.id
                    )));
                }
            }
        }
        if let Some(sync) = &edge.sync {
            validate_schedule(&sync.schedule)?;
        }
    }
    Ok(())
}

fn validate_node(
    node: &StorageNode,
    remotes: Option<&[String]>,
    home: Option<&Path>,
) -> CoreResult<()> {
    match node.kind {
        NodeKind::Local => {
            let path = node.local_path.as_deref().ok_or_else(|| {
                CoreError::InvalidPath(format!("local node {} requires local_path", node.id))
            })?;
            let normalized = validate_local_path(path, home)?;
            if normalized.exists() {
                let metadata = std::fs::metadata(&normalized)?;
                if metadata.is_file() {
                    return Err(CoreError::InvalidPath(format!(
                        "local node {} path must be a directory",
                        node.id
                    )));
                }
            }
            if node.remote.is_some() {
                return Err(CoreError::InvalidRequest(format!(
                    "local node {} must not include a remote",
                    node.id
                )));
            }
        }
        NodeKind::Remote => {
            let remote = node.remote.as_ref().ok_or_else(|| {
                CoreError::InvalidPath(format!("remote node {} requires remote", node.id))
            })?;
            let name = validate_remote_name(&remote.name)?;
            validate_relative_path(&remote.path)?;
            if let Some(remotes) = remotes {
                if !remotes.iter().any(|item| item == &name) {
                    return Err(CoreError::NotFound(format!("remote {name}")));
                }
            }
            if node.local_path.is_some() {
                return Err(CoreError::InvalidRequest(format!(
                    "remote node {} must not include local_path",
                    node.id
                )));
            }
        }
    }
    Ok(())
}

pub fn validate_schedule(schedule: &ScheduleConfig) -> CoreResult<()> {
    schedule.timezone.parse::<chrono_tz::Tz>().map_err(|_| {
        CoreError::InvalidRequest(format!("invalid timezone {}", schedule.timezone))
    })?;
    match schedule.mode {
        ScheduleMode::Preset => {
            if schedule.preset.is_none() {
                return Err(CoreError::InvalidRequest(
                    "preset schedule requires a preset".into(),
                ));
            }
        }
        ScheduleMode::Cron => {
            let cron = schedule.cron.as_deref().ok_or_else(|| {
                CoreError::InvalidRequest("cron schedule requires a cron expression".into())
            })?;
            croner::Cron::new(cron).parse().map_err(|error| {
                CoreError::InvalidRequest(format!("invalid cron expression: {error}"))
            })?;
        }
    }
    Ok(())
}

fn load_workspace(path: &Path) -> CoreResult<WorkspaceDocument> {
    let bytes = read_json_bytes(path)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| CoreError::CorruptStore {
        message: format!("{}: {error}", path.display()),
    })?;
    migrate_workspace(value)
}

fn migrate_workspace(value: Value) -> CoreResult<WorkspaceDocument> {
    let version = value
        .get("schema_version")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u32;
    let migrated = match version {
        0 => {
            let mut object = match value {
                Value::Object(map) => map,
                _ => {
                    return Err(CoreError::CorruptStore {
                        message: "workspace document is not an object".into(),
                    })
                }
            };
            object
                .entry("schema_version")
                .or_insert_with(|| json!(WORKSPACE_SCHEMA_VERSION));
            object.entry("revision").or_insert_with(|| json!(0));
            object.entry("nodes").or_insert_with(|| json!([]));
            object.entry("edges").or_insert_with(|| json!([]));
            object
                .entry("viewport")
                .or_insert_with(|| json!({ "x": 0, "y": 0, "zoom": 1 }));
            object
                .entry("updated_at")
                .or_insert_with(|| json!(Utc::now()));
            Value::Object(object)
        }
        WORKSPACE_SCHEMA_VERSION => value,
        other => {
            return Err(CoreError::UnsupportedSchema {
                document: "workspace".into(),
                version: other,
            })
        }
    };
    serde_json::from_value(migrated).map_err(|error| CoreError::CorruptStore {
        message: format!("workspace: {error}"),
    })
}

pub fn related_edge_ids(doc: &WorkspaceDocument, node_id: &str) -> Vec<String> {
    doc.edges
        .iter()
        .filter(|edge| edge.source == node_id || edge.target == node_id)
        .map(|edge| edge.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        validate_workspace, ConnectionEdge, EdgeKind, NodeKind, Position, RemoteRef, StorageNode,
        SyncConfig, SyncOperation, Viewport, WorkspaceDocument,
    };
    use ourboros_core::CoreError;

    fn local_node(id: &str, path: &str) -> StorageNode {
        StorageNode {
            id: id.into(),
            kind: NodeKind::Local,
            label: id.into(),
            position: Position { x: 0.0, y: 0.0 },
            local_path: Some(path.into()),
            remote: None,
        }
    }

    fn remote_node(id: &str, name: &str) -> StorageNode {
        StorageNode {
            id: id.into(),
            kind: NodeKind::Remote,
            label: id.into(),
            position: Position { x: 1.0, y: 1.0 },
            local_path: None,
            remote: Some(RemoteRef {
                name: name.into(),
                path: String::new(),
            }),
        }
    }

    #[test]
    fn validate_workspace_should_reject_illegal_mount_direction() {
        let doc = WorkspaceDocument {
            schema_version: 1,
            revision: 0,
            nodes: vec![
                local_node("local", "/tmp/ourboros-local"),
                remote_node("remote", "archive"),
            ],
            edges: vec![ConnectionEdge {
                id: "e1".into(),
                source: "local".into(),
                target: "remote".into(),
                kind: EdgeKind::Mount,
                sync: None,
                mount: None,
            }],
            viewport: Viewport::default(),
            updated_at: chrono::Utc::now(),
        };
        let error = validate_workspace(&doc, None, None).unwrap_err();
        assert!(matches!(error, CoreError::InvalidRequest(_)));
    }

    #[test]
    fn validate_workspace_should_reject_orphan_and_duplicate_edges() {
        let mut doc = WorkspaceDocument {
            schema_version: 1,
            revision: 0,
            nodes: vec![
                local_node("local", "/tmp/ourboros-local"),
                remote_node("remote", "archive"),
            ],
            edges: vec![ConnectionEdge {
                id: "e1".into(),
                source: "missing".into(),
                target: "local".into(),
                kind: EdgeKind::Sync,
                sync: Some(SyncConfig::default_for(SyncOperation::Copy)),
                mount: None,
            }],
            viewport: Viewport::default(),
            updated_at: chrono::Utc::now(),
        };
        assert!(validate_workspace(&doc, None, None).is_err());
        doc.edges[0].source = "remote".into();
        assert!(validate_workspace(&doc, None, None).is_ok());
        doc.edges.push(ConnectionEdge {
            id: "e2".into(),
            source: "remote".into(),
            target: "local".into(),
            kind: EdgeKind::Sync,
            sync: Some(SyncConfig::default_for(SyncOperation::Copy)),
            mount: None,
        });
        assert!(validate_workspace(&doc, None, None).is_err());
    }
}
