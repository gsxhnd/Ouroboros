use std::time::Duration;

use reqwest::Client;
use serde_json::{json, Value};

use crate::error::{CoreError, CoreResult};

use super::command::{join_rc_url, validate_command};
use super::types::{RcResponse, RcloneVersion};

#[derive(Debug, Clone)]
pub struct RcClient {
    http: Client,
}

impl RcClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self { http }
    }

    pub async fn call(&self, rc_url: &str, command: &str, body: Value) -> CoreResult<RcResponse> {
        validate_command(command)?;

        let url = join_rc_url(rc_url, command);
        let response = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|error| CoreError::Transport(error.to_string()))?;

        let status = response.status().as_u16();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| CoreError::Transport(error.to_string()))?;

        if bytes.is_empty() {
            return Ok(RcResponse {
                status,
                body: json!({}),
            });
        }

        let body = serde_json::from_slice(&bytes).unwrap_or_else(|_| {
            json!({
                "error": String::from_utf8_lossy(&bytes),
            })
        });

        Ok(RcResponse { status, body })
    }

    pub async fn version(&self, rc_url: &str) -> CoreResult<RcloneVersion> {
        let response = self.call(rc_url, "core/version", json!({})).await?;
        if !(200..300).contains(&response.status) {
            let message = response
                .body
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("rclone rc returned an error")
                .to_string();
            return Err(CoreError::Transport(message));
        }

        serde_json::from_value(response.body)
            .map_err(|error| CoreError::Transport(error.to_string()))
    }
}

impl Default for RcClient {
    fn default() -> Self {
        Self::new()
    }
}
