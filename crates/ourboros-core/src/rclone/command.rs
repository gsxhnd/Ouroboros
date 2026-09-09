use crate::error::{CoreError, CoreResult};

const PROXY_ALLOWLIST: &[&str] = &[
    "core/version",
    "core/stats",
    "config/listremotes",
    "operations/list",
    "operations/mkdir",
    "operations/deletefile",
    "operations/purge",
];

const SENSITIVE_COMMANDS: &[&str] = &[
    "config/dump",
    "config/get",
    "config/password",
    "config/providers",
    "options/get",
    "core/pid",
    "core/command",
];

pub fn join_rc_url(base: &str, command: &str) -> String {
    format!(
        "{}/{}",
        base.trim_end_matches('/'),
        command.trim_start_matches('/')
    )
}

pub fn validate_command(command: &str) -> CoreResult<()> {
    if command.is_empty()
        || !command
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '/' | '_' | '-'))
    {
        return Err(CoreError::InvalidCommand(command.to_string()));
    }
    Ok(())
}

pub fn is_sensitive_command(command: &str) -> bool {
    SENSITIVE_COMMANDS
        .iter()
        .any(|denied| command.eq_ignore_ascii_case(denied))
        || command.to_ascii_lowercase().contains("dump")
        || command.to_ascii_lowercase().contains("password")
}

pub fn validate_proxy_command(command: &str) -> CoreResult<()> {
    validate_command(command)?;
    if is_sensitive_command(command) || !PROXY_ALLOWLIST.contains(&command) {
        return Err(CoreError::ForbiddenCommand(command.to_string()));
    }
    Ok(())
}

pub fn redact_secrets(input: &str, secrets: &[&str]) -> String {
    let mut redacted = input.to_string();
    for secret in secrets {
        if secret.len() >= 4 {
            redacted = redacted.replace(*secret, "***");
        }
    }
    redacted
}

#[cfg(test)]
mod tests {
    use super::{join_rc_url, validate_command, validate_proxy_command};

    #[test]
    fn join_rc_url_trims_slashes() {
        assert_eq!(
            join_rc_url("http://127.0.0.1:5572/", "/core/version"),
            "http://127.0.0.1:5572/core/version"
        );
    }

    #[test]
    fn validate_command_accepts_rclone_paths() {
        assert!(validate_command("config/listremotes").is_ok());
        assert!(validate_command("core/version").is_ok());
        assert!(validate_command("operations/list").is_ok());
    }

    #[test]
    fn validate_command_rejects_unsafe_paths() {
        assert!(validate_command("../etc/passwd").is_err());
        assert!(validate_command("core/version?x=1").is_err());
        assert!(validate_command("http://example.com").is_err());
        assert!(validate_command("").is_err());
    }

    #[test]
    fn validate_proxy_command_should_allow_only_allowlist() {
        assert!(validate_proxy_command("core/version").is_ok());
        assert!(validate_proxy_command("config/listremotes").is_ok());
        assert!(validate_proxy_command("config/dump").is_err());
        assert!(validate_proxy_command("config/create").is_err());
        assert!(validate_proxy_command("sync/copy").is_err());
        assert!(validate_proxy_command("operations/copyfile").is_err());
    }
}
