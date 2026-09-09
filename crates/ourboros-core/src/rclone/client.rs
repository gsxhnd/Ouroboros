use std::time::Duration;

use reqwest::Client;
use serde_json::{json, Value};

use crate::error::{CoreError, CoreResult};

use super::command::{join_rc_url, validate_command};
use super::types::{RcResponse, RcloneVersion};

#[derive(Debug, Clone)]
pub struct RcAuth {
    pub user: String,
    pub pass: String,
}

#[derive(Debug, Clone)]
pub struct RcClient {
    http: Client,
}

impl RcClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(120))
            .connect_timeout(Duration::from_secs(5))
            .user_agent(concat!("ourboros/", env!("CARGO_PKG_VERSION")))
            .build()
            .unwrap_or_else(|error| {
                tracing::error!(%error, "failed to build reqwest client; using default");
                Client::new()
            });

        Self { http }
    }

    pub fn http(&self) -> &Client {
        &self.http
    }

    pub async fn call(
        &self,
        rc_url: &str,
        auth: Option<&RcAuth>,
        command: &str,
        body: Value,
    ) -> CoreResult<RcResponse> {
        validate_command(command)?;

        let url = join_rc_url(rc_url, command);
        let mut request = self.http.post(url).json(&body);
        if let Some(auth) = auth {
            request = request.basic_auth(&auth.user, Some(&auth.pass));
        }

        let response = request
            .send()
            .await
            .map_err(|error| transport_error(error, auth))?;

        let status = response.status().as_u16();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| transport_error(error, auth))?;

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

    pub async fn version(&self, rc_url: &str, auth: Option<&RcAuth>) -> CoreResult<RcloneVersion> {
        let response = self.call(rc_url, auth, "core/version", json!({})).await?;
        if !response.is_success() {
            let message = response
                .body
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("rclone rc returned an error")
                .to_string();
            return Err(CoreError::Transport(redact_auth(&message, auth)));
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

fn transport_error(error: reqwest::Error, auth: Option<&RcAuth>) -> CoreError {
    CoreError::Transport(redact_auth(&error.to_string(), auth))
}

fn redact_auth(message: &str, auth: Option<&RcAuth>) -> String {
    match auth {
        Some(auth) => super::command::redact_secrets(message, &[&auth.user, &auth.pass]),
        None => message.to_string(),
    }
}
