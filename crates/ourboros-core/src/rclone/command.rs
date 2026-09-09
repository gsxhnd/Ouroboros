use crate::error::{CoreError, CoreResult};

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

#[cfg(test)]
mod tests {
    use super::{join_rc_url, validate_command};

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
}
