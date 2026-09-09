use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PathKind {
    Local,
    Remote,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileLocator {
    pub kind: PathKind,
    pub fs: String,
    pub remote: String,
}

impl FileLocator {
    pub fn parse(fs: &str, remote: &str, home: Option<&Path>) -> CoreResult<Self> {
        let relative = validate_relative_path(remote)?;
        if looks_like_local(fs) {
            let local = validate_local_path(fs, home)?;
            Ok(Self {
                kind: PathKind::Local,
                fs: path_to_string(&local),
                remote: relative,
            })
        } else {
            Ok(Self {
                kind: PathKind::Remote,
                fs: validate_remote_name(fs)?,
                remote: relative,
            })
        }
    }

    pub fn rclone_fs(&self) -> String {
        match self.kind {
            PathKind::Local => self.fs.clone(),
            PathKind::Remote if self.fs.ends_with(':') => self.fs.clone(),
            PathKind::Remote => format!("{}:", self.fs),
        }
    }

    pub fn rclone_remote(&self) -> &str {
        &self.remote
    }

    pub fn combined_fs(&self) -> String {
        let fs = self.rclone_fs();
        if self.remote.is_empty() {
            return fs;
        }
        match self.kind {
            PathKind::Local => format!(
                "{}/{}",
                fs.trim_end_matches(['/', '\\']),
                self.remote.trim_start_matches('/')
            ),
            PathKind::Remote => format!("{fs}{}", self.remote.trim_start_matches('/')),
        }
    }

    pub fn display(&self) -> String {
        self.combined_fs()
    }
}

pub fn looks_like_local(fs: &str) -> bool {
    let trimmed = fs.trim();
    if trimmed.is_empty() {
        return false;
    }
    if trimmed == "~" || trimmed.starts_with("~/") || trimmed.starts_with("~\\") {
        return true;
    }
    let path = Path::new(trimmed);
    path.is_absolute()
        || trimmed.starts_with('/')
        || trimmed.starts_with('\\')
        || (trimmed.len() >= 2 && trimmed.as_bytes()[1] == b':')
}

pub fn validate_remote_name(name: &str) -> CoreResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(CoreError::InvalidPath("remote name is required".into()));
    }
    if name.ends_with(':') {
        return validate_remote_name(name.trim_end_matches(':'));
    }
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return Err(CoreError::InvalidPath("remote name is required".into()));
    };
    if !first.is_ascii_alphanumeric() {
        return Err(CoreError::InvalidPath(format!(
            "invalid remote name '{name}'"
        )));
    }
    if !chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.')) {
        return Err(CoreError::InvalidPath(format!(
            "invalid remote name '{name}'"
        )));
    }
    Ok(name.to_string())
}

pub fn validate_relative_path(path: &str) -> CoreResult<String> {
    let normalized = path.replace('\\', "/").trim().to_string();
    if normalized.is_empty() {
        return Ok(String::new());
    }
    if Path::new(&normalized).is_absolute() || normalized.starts_with('/') {
        return Err(CoreError::InvalidPath(
            "relative path must not be absolute".into(),
        ));
    }
    if normalized.contains(':') {
        return Err(CoreError::InvalidPath(
            "relative path must not contain a drive or remote prefix".into(),
        ));
    }
    let mut parts = Vec::new();
    for component in normalized.split('/') {
        if component.is_empty() || component == "." {
            continue;
        }
        if component == ".." {
            return Err(CoreError::InvalidPath(
                "path traversal is not allowed".into(),
            ));
        }
        parts.push(component);
    }
    Ok(parts.join("/"))
}

pub fn validate_local_path(path: &str, home: Option<&Path>) -> CoreResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(CoreError::InvalidPath("local path is required".into()));
    }
    let expanded = expand_home(trimmed, home)?;
    if !expanded.is_absolute() {
        return Err(CoreError::InvalidPath(format!(
            "local path must be absolute: {trimmed}"
        )));
    }
    lexical_normalize(&expanded)
}

pub fn join_relative(base: &str, child: &str) -> CoreResult<String> {
    let base = validate_relative_path(base)?;
    let child = validate_relative_path(child)?;
    Ok(match (base.is_empty(), child.is_empty()) {
        (true, true) => String::new(),
        (true, false) => child,
        (false, true) => base,
        (false, false) => format!("{base}/{child}"),
    })
}

fn expand_home(path: &str, home: Option<&Path>) -> CoreResult<PathBuf> {
    if path == "~" || path.starts_with("~/") || path.starts_with("~\\") {
        let home =
            home.ok_or_else(|| CoreError::InvalidPath("HOME is not available to expand ~".into()))?;
        if path == "~" {
            return Ok(home.to_path_buf());
        }
        return Ok(home.join(&path[2..]));
    }
    Ok(PathBuf::from(path))
}

fn lexical_normalize(path: &Path) -> CoreResult<PathBuf> {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => out.push(prefix.as_os_str()),
            Component::RootDir => out.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    return Err(CoreError::InvalidPath(
                        "path traversal is not allowed".into(),
                    ));
                }
            }
            Component::Normal(part) => {
                if part == ".." {
                    return Err(CoreError::InvalidPath(
                        "path traversal is not allowed".into(),
                    ));
                }
                out.push(part);
            }
        }
    }
    Ok(out)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::{
        join_relative, looks_like_local, validate_local_path, validate_relative_path,
        validate_remote_name, FileLocator, PathKind,
    };
    use std::path::PathBuf;

    #[test]
    fn validate_relative_path_should_reject_traversal() {
        assert!(validate_relative_path("../secret").is_err());
        assert!(validate_relative_path("/etc/passwd").is_err());
        assert_eq!(validate_relative_path("a/./b").unwrap(), "a/b");
        assert_eq!(validate_relative_path("").unwrap(), "");
    }

    #[test]
    fn validate_remote_name_should_accept_rclone_names() {
        assert_eq!(validate_remote_name("archive").unwrap(), "archive");
        assert_eq!(validate_remote_name("s3-backup").unwrap(), "s3-backup");
        assert!(validate_remote_name("bad/name").is_err());
        assert!(validate_remote_name("").is_err());
    }

    #[test]
    fn validate_local_path_should_require_absolute_and_normalize() {
        let home = PathBuf::from("/Users/example");
        let path = validate_local_path("/Users/example/Backups/../safe", Some(&home)).unwrap();
        assert_eq!(path, PathBuf::from("/Users/example/safe"));
        assert!(validate_local_path("relative", Some(&home)).is_err());
        let expanded = validate_local_path("~/Backups", Some(&home)).unwrap();
        assert_eq!(expanded, PathBuf::from("/Users/example/Backups"));
    }

    #[test]
    fn file_locator_should_split_local_and_remote() {
        let home = PathBuf::from("/Users/example");
        let local = FileLocator::parse("/Users/example/Backups", "", Some(&home)).unwrap();
        assert_eq!(local.kind, PathKind::Local);
        assert_eq!(local.combined_fs(), "/Users/example/Backups");

        let remote = FileLocator::parse("archive", "ourboros", Some(&home)).unwrap();
        assert_eq!(remote.kind, PathKind::Remote);
        assert_eq!(remote.combined_fs(), "archive:ourboros");
        assert!(looks_like_local("/tmp"));
        assert!(!looks_like_local("archive"));
    }

    #[test]
    fn join_relative_should_preserve_empty_roots() {
        assert_eq!(join_relative("", "a/b").unwrap(), "a/b");
        assert_eq!(join_relative("a", "b").unwrap(), "a/b");
        assert!(join_relative("a", "../b").is_err());
    }
}
