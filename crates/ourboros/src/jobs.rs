use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use ourboros_core::{CoreError, CoreResult, FileLocator, RcloneSupervisor};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::events::AppEvent;
use crate::workspace::{LastResult, SyncOperation, WorkspaceStore};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Cancelling,
    Succeeded,
    Failed,
    PartialFailed,
    Cancelled,
    Expired,
}

impl JobStatus {
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Succeeded | Self::Failed | Self::PartialFailed | Self::Cancelled | Self::Expired
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub bytes: u64,
    pub transfers: u64,
    pub checks: u64,
    pub errors: u64,
    pub percentage: f64,
    pub speed: f64,
    pub eta_seconds: Option<f64>,
}

impl Default for JobProgress {
    fn default() -> Self {
        Self {
            bytes: 0,
            transfers: 0,
            checks: 0,
            errors: 0,
            percentage: 0.0,
            speed: 0.0,
            eta_seconds: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSnapshot {
    pub id: String,
    pub edge_id: String,
    pub operation: SyncOperation,
    pub status: JobStatus,
    pub destructive: bool,
    pub source: FileLocator,
    pub target: FileLocator,
    pub impact: String,
    pub progress: JobProgress,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
}

struct JobRecord {
    snapshot: JobSnapshot,
    rclone_jobid: Option<i64>,
}

pub struct JobStore {
    inner: Mutex<Inner>,
    events: tokio::sync::broadcast::Sender<AppEvent>,
}

struct Inner {
    jobs: HashMap<String, JobRecord>,
    running_edges: HashSet<String>,
}

impl JobStore {
    pub fn new(events: tokio::sync::broadcast::Sender<AppEvent>) -> Self {
        Self {
            inner: Mutex::new(Inner {
                jobs: HashMap::new(),
                running_edges: HashSet::new(),
            }),
            events,
        }
    }

    pub async fn list(&self) -> Vec<JobSnapshot> {
        let inner = self.inner.lock().await;
        let mut jobs: Vec<_> = inner
            .jobs
            .values()
            .map(|record| record.snapshot.clone())
            .collect();
        jobs.sort_by_key(|job| std::cmp::Reverse(job.started_at));
        jobs
    }

    pub async fn get(&self, id: &str) -> CoreResult<JobSnapshot> {
        self.inner
            .lock()
            .await
            .jobs
            .get(id)
            .map(|record| record.snapshot.clone())
            .ok_or_else(|| CoreError::NotFound(format!("job {id}")))
    }

    pub async fn is_running(&self, edge_id: &str) -> bool {
        self.inner.lock().await.running_edges.contains(edge_id)
    }

    pub async fn start(
        self: &Arc<Self>,
        rclone: Arc<RcloneSupervisor>,
        workspace: Arc<WorkspaceStore>,
        edge_id: &str,
        operation: SyncOperation,
        source: FileLocator,
        target: FileLocator,
    ) -> CoreResult<JobSnapshot> {
        let mut inner = self.inner.lock().await;
        if inner.running_edges.contains(edge_id) {
            return Err(CoreError::Conflict(format!(
                "edge {edge_id} already has a running job"
            )));
        }

        let id = Uuid::new_v4().to_string();
        let snapshot = JobSnapshot {
            id: id.clone(),
            edge_id: edge_id.to_string(),
            operation,
            status: JobStatus::Running,
            destructive: operation.is_destructive(),
            impact: operation.impact(&source.display(), &target.display()),
            source: source.clone(),
            target: target.clone(),
            progress: JobProgress::default(),
            error: None,
            started_at: Utc::now(),
            finished_at: None,
        };
        inner.running_edges.insert(edge_id.to_string());
        inner.jobs.insert(
            id.clone(),
            JobRecord {
                snapshot: snapshot.clone(),
                rclone_jobid: None,
            },
        );
        drop(inner);
        self.emit(&snapshot);

        let body = json!({
            "srcFs": source.combined_fs(),
            "dstFs": target.combined_fs(),
            "_async": true,
            "_group": snapshot.id,
        });
        let response = match rclone.call_internal(operation.rclone_command(), body).await {
            Ok(response) if response.is_success() => response,
            Ok(response) => {
                self.fail(&id, upstream_error(&response.body)).await;
                return Err(CoreError::Transport(upstream_error(&response.body)));
            }
            Err(error) => {
                self.fail(&id, error.to_string()).await;
                return Err(error);
            }
        };

        let jobid = response.body.get("jobid").and_then(Value::as_i64);
        {
            let mut inner = self.inner.lock().await;
            if let Some(record) = inner.jobs.get_mut(&id) {
                record.rclone_jobid = jobid;
            }
        }

        let jobs = Arc::clone(self);
        let edge = edge_id.to_string();
        tokio::spawn(async move {
            jobs.poll_until_done(rclone, workspace, id, edge).await;
        });

        self.get(&snapshot.id).await
    }

    pub async fn stop(&self, rclone: &RcloneSupervisor, job_id: &str) -> CoreResult<JobSnapshot> {
        let (rclone_jobid, edge_id) = {
            let mut inner = self.inner.lock().await;
            let record = inner
                .jobs
                .get_mut(job_id)
                .ok_or_else(|| CoreError::NotFound(format!("job {job_id}")))?;
            if record.snapshot.status.is_terminal() {
                return Ok(record.snapshot.clone());
            }
            record.snapshot.status = JobStatus::Cancelling;
            (record.rclone_jobid, record.snapshot.edge_id.clone())
        };
        if let Some(jobid) = rclone_jobid {
            let _ = rclone
                .call_internal("job/stop", json!({ "jobid": jobid }))
                .await;
        }
        self.finish(
            job_id,
            &edge_id,
            JobStatus::Cancelled,
            Some("job cancelled".into()),
            None,
        )
        .await
    }

    pub async fn expire_running(&self, reason: &str) {
        let running: Vec<(String, String)> = {
            let inner = self.inner.lock().await;
            inner
                .jobs
                .values()
                .filter(|record| !record.snapshot.status.is_terminal())
                .map(|record| (record.snapshot.id.clone(), record.snapshot.edge_id.clone()))
                .collect()
        };
        for (id, edge_id) in running {
            let _ = self
                .finish(&id, &edge_id, JobStatus::Expired, Some(reason.into()), None)
                .await;
        }
    }

    async fn poll_until_done(
        &self,
        rclone: Arc<RcloneSupervisor>,
        workspace: Arc<WorkspaceStore>,
        job_id: String,
        edge_id: String,
    ) {
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            let rclone_jobid = {
                let inner = self.inner.lock().await;
                match inner.jobs.get(&job_id) {
                    Some(record) if !record.snapshot.status.is_terminal() => record.rclone_jobid,
                    _ => return,
                }
            };

            if !rclone.status().await.running {
                let _ = self
                    .finish(
                        &job_id,
                        &edge_id,
                        JobStatus::Expired,
                        Some("rclone became unavailable".into()),
                        None,
                    )
                    .await;
                return;
            }

            let mut progress = JobProgress::default();
            if let Ok(stats) = rclone
                .call_internal("core/stats", json!({ "group": job_id, "short": true }))
                .await
            {
                if stats.is_success() {
                    progress = parse_stats(&stats.body);
                }
            }

            let mut finished = false;
            let mut success = false;
            let mut error = None;
            if let Some(jobid) = rclone_jobid {
                match rclone
                    .call_internal("job/status", json!({ "jobid": jobid }))
                    .await
                {
                    Ok(response) if response.is_success() => {
                        finished = response
                            .body
                            .get("finished")
                            .and_then(Value::as_bool)
                            .unwrap_or(false);
                        success = response
                            .body
                            .get("success")
                            .and_then(Value::as_bool)
                            .unwrap_or(false);
                        error = response
                            .body
                            .get("error")
                            .and_then(Value::as_str)
                            .filter(|value| !value.is_empty())
                            .map(ToOwned::to_owned);
                        if let Some(job_progress) = response.body.get("progress") {
                            merge_progress(&mut progress, job_progress);
                        }
                    }
                    Ok(_) | Err(_) => {
                        if !rclone.status().await.running {
                            let _ = self
                                .finish(
                                    &job_id,
                                    &edge_id,
                                    JobStatus::Expired,
                                    Some("rclone became unavailable".into()),
                                    None,
                                )
                                .await;
                            return;
                        }
                    }
                }
            }

            {
                let mut inner = self.inner.lock().await;
                if let Some(record) = inner.jobs.get_mut(&job_id) {
                    record.snapshot.progress = progress.clone();
                    let snapshot = record.snapshot.clone();
                    drop(inner);
                    self.emit(&snapshot);
                }
            }

            if finished {
                let status = if !success {
                    JobStatus::Failed
                } else if progress.errors > 0 {
                    JobStatus::PartialFailed
                } else {
                    JobStatus::Succeeded
                };
                if let Ok(snapshot) = self
                    .finish(&job_id, &edge_id, status, error, Some(progress))
                    .await
                {
                    let _ = workspace
                        .record_job_result(
                            &edge_id,
                            LastResult {
                                job_id: snapshot.id.clone(),
                                status: serde_json::to_value(snapshot.status)
                                    .ok()
                                    .and_then(|value| value.as_str().map(ToOwned::to_owned))
                                    .unwrap_or_else(|| format!("{:?}", snapshot.status)),
                                finished_at: snapshot.finished_at,
                                error: snapshot.error.clone(),
                            },
                            None,
                        )
                        .await;
                }
                return;
            }
        }
    }

    async fn fail(&self, id: &str, message: String) {
        let edge_id = {
            let inner = self.inner.lock().await;
            inner
                .jobs
                .get(id)
                .map(|record| record.snapshot.edge_id.clone())
                .unwrap_or_default()
        };
        let _ = self
            .finish(id, &edge_id, JobStatus::Failed, Some(message), None)
            .await;
    }

    async fn finish(
        &self,
        id: &str,
        edge_id: &str,
        status: JobStatus,
        error: Option<String>,
        progress: Option<JobProgress>,
    ) -> CoreResult<JobSnapshot> {
        let mut inner = self.inner.lock().await;
        inner.running_edges.remove(edge_id);
        let record = inner
            .jobs
            .get_mut(id)
            .ok_or_else(|| CoreError::NotFound(format!("job {id}")))?;
        record.snapshot.status = status;
        record.snapshot.error = error;
        record.snapshot.finished_at = Some(Utc::now());
        if let Some(progress) = progress {
            record.snapshot.progress = progress;
        }
        let snapshot = record.snapshot.clone();
        drop(inner);
        self.emit(&snapshot);
        Ok(snapshot)
    }

    fn emit(&self, snapshot: &JobSnapshot) {
        let _ = self.events.send(AppEvent::Job(snapshot.clone()));
    }
}

fn parse_stats(body: &Value) -> JobProgress {
    JobProgress {
        bytes: body.get("bytes").and_then(Value::as_u64).unwrap_or(0),
        transfers: body.get("transfers").and_then(Value::as_u64).unwrap_or(0),
        checks: body.get("checks").and_then(Value::as_u64).unwrap_or(0),
        errors: body.get("errors").and_then(Value::as_u64).unwrap_or(0),
        percentage: body
            .get("transferring")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("percentage"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        speed: body.get("speed").and_then(Value::as_f64).unwrap_or(0.0),
        eta_seconds: body.get("eta").and_then(Value::as_f64),
    }
}

fn merge_progress(progress: &mut JobProgress, value: &Value) {
    if let Some(bytes) = value.get("bytes").and_then(Value::as_u64) {
        progress.bytes = bytes;
    }
    if let Some(percentage) = value.get("percentage").and_then(Value::as_f64) {
        progress.percentage = percentage;
    }
    if let Some(speed) = value.get("speed").and_then(Value::as_f64) {
        progress.speed = speed;
    }
    if let Some(eta) = value.get("eta").and_then(Value::as_f64) {
        progress.eta_seconds = Some(eta);
    }
}

fn upstream_error(body: &Value) -> String {
    body.get("error")
        .and_then(Value::as_str)
        .unwrap_or("rclone job failed")
        .to_string()
}
