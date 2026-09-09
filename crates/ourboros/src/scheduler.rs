use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use croner::Cron;
use ourboros_core::{CoreError, CoreResult};

use crate::state::AppState;
use crate::workspace::{EdgeKind, ScheduleConfig, ScheduleMode, SchedulePreset};

pub async fn run_loop(state: AppState) {
    loop {
        tokio::time::sleep(Duration::from_secs(15)).await;
        if let Err(error) = tick(&state).await {
            tracing::warn!(error = %error, "sync scheduler tick failed");
        }
    }
}

async fn tick(state: &AppState) -> CoreResult<()> {
    let doc = state.workspace.get().await;
    let now = Utc::now();
    for edge in &doc.edges {
        if edge.kind != EdgeKind::Sync {
            continue;
        }
        let Some(sync) = &edge.sync else {
            continue;
        };
        if !sync.enabled || !sync.schedule.enabled {
            continue;
        }
        if state.jobs.is_running(&edge.id).await {
            continue;
        }

        let next = match sync.next_run {
            Some(next) => next,
            None => {
                if let Some(computed) = next_run_at(&sync.schedule, now)? {
                    state
                        .workspace
                        .set_next_run(&edge.id, Some(computed))
                        .await?;
                }
                continue;
            }
        };
        if next > now {
            continue;
        }

        let source = doc.node_locator(&edge.source)?;
        let target = doc.node_locator(&edge.target)?;
        match state
            .jobs
            .start(
                Arc::clone(&state.rclone),
                Arc::clone(&state.workspace),
                &edge.id,
                sync.operation,
                source,
                target,
            )
            .await
        {
            Ok(_) => {
                if let Some(computed) = next_run_at(&sync.schedule, Utc::now())? {
                    state
                        .workspace
                        .set_next_run(&edge.id, Some(computed))
                        .await?;
                }
            }
            Err(error) => {
                tracing::warn!(edge_id = %edge.id, error = %error, "scheduled sync failed to start");
            }
        }
    }
    Ok(())
}

pub fn cron_expression(schedule: &ScheduleConfig) -> CoreResult<String> {
    match schedule.mode {
        ScheduleMode::Preset => {
            let preset = schedule.preset.ok_or_else(|| {
                CoreError::InvalidRequest("preset schedule requires a preset".into())
            })?;
            Ok(match preset {
                SchedulePreset::Hourly => "0 * * * *".into(),
                SchedulePreset::Daily => "0 0 * * *".into(),
                SchedulePreset::Weekly => "0 0 * * 0".into(),
            })
        }
        ScheduleMode::Cron => schedule.cron.clone().ok_or_else(|| {
            CoreError::InvalidRequest("cron schedule requires a cron expression".into())
        }),
    }
}

pub fn next_run_at(
    schedule: &ScheduleConfig,
    from: DateTime<Utc>,
) -> CoreResult<Option<DateTime<Utc>>> {
    if !schedule.enabled {
        return Ok(None);
    }
    let expression = cron_expression(schedule)?;
    let cron = Cron::new(&expression)
        .parse()
        .map_err(|error| CoreError::InvalidRequest(format!("invalid cron expression: {error}")))?;
    let timezone: Tz = schedule.timezone.parse().map_err(|_| {
        CoreError::InvalidRequest(format!("invalid timezone {}", schedule.timezone))
    })?;
    let local = from.with_timezone(&timezone);
    let next = cron.find_next_occurrence(&local, false).map_err(|error| {
        CoreError::InvalidRequest(format!("could not compute next run: {error}"))
    })?;
    Ok(Some(next.with_timezone(&Utc)))
}

#[cfg(test)]
mod tests {
    use super::next_run_at;
    use crate::workspace::{ScheduleConfig, ScheduleMode, SchedulePreset};
    use chrono::{TimeZone, Utc};

    #[test]
    fn next_run_at_should_compute_hourly_in_timezone() {
        let schedule = ScheduleConfig {
            mode: ScheduleMode::Preset,
            preset: Some(SchedulePreset::Hourly),
            cron: None,
            timezone: "UTC".into(),
            enabled: true,
        };
        let from = Utc.with_ymd_and_hms(2026, 9, 9, 10, 15, 0).unwrap();
        let next = next_run_at(&schedule, from).unwrap().unwrap();
        assert_eq!(next, Utc.with_ymd_and_hms(2026, 9, 9, 11, 0, 0).unwrap());
    }

    #[test]
    fn next_run_at_should_return_none_when_disabled() {
        let schedule = ScheduleConfig::disabled();
        assert!(next_run_at(&schedule, Utc::now()).unwrap().is_none());
    }
}
