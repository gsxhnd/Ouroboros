use std::path::{Path, PathBuf};

use axum::Router;
use tower_http::services::{ServeDir, ServeFile};
use tracing::warn;

/// Resolve the directory that should serve the web UI.
///
/// An explicit CLI/`OURBOROS_WEB_DIR` path is required to contain `index.html`.
/// Bundled locations next to the binary are optional and fall back to API-only.
pub fn resolve_web_dir(explicit: Option<PathBuf>) -> anyhow::Result<Option<PathBuf>> {
    match explicit {
        Some(path) => require_web_dir(&path).map(Some),
        None => Ok(discover_bundled_web_dir()),
    }
}

pub fn require_web_dir(path: &Path) -> anyhow::Result<PathBuf> {
    let canonical = path.canonicalize().map_err(|error| {
        anyhow::anyhow!("web UI directory not found: {}: {error}", path.display())
    })?;
    if !canonical.join("index.html").is_file() {
        anyhow::bail!(
            "web UI directory is missing index.html: {}",
            canonical.display()
        );
    }
    Ok(canonical)
}

pub fn attach_static(router: Router, web_dir: Option<&Path>) -> Router {
    let Some(web_dir) = web_dir else {
        return router;
    };

    let index = web_dir.join("index.html");
    if !index.is_file() {
        warn!(
            web_dir = %web_dir.display(),
            "web directory has no index.html; static UI disabled"
        );
        return router;
    }

    let static_files = ServeDir::new(web_dir).not_found_service(ServeFile::new(index));
    router.fallback_service(static_files)
}

fn discover_bundled_web_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let parent = exe.parent()?;
    let candidates = [
        parent.join("web"),
        parent.join("../Resources/web"),
        parent.join("../share/ourboros/web"),
    ];
    candidates.into_iter().find_map(|candidate| {
        let canonical = candidate.canonicalize().ok()?;
        canonical.join("index.html").is_file().then_some(canonical)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn require_web_dir_should_error_when_directory_is_missing() {
        let error = require_web_dir(Path::new("/definitely-not-an-ourboros-webui")).unwrap_err();
        assert!(error.to_string().contains("not found"));
    }

    #[test]
    fn require_web_dir_should_error_when_index_html_is_missing() {
        let dir = TempDir::new().expect("tempdir");
        let error = require_web_dir(dir.path()).unwrap_err();
        assert!(error.to_string().contains("index.html"));
    }

    #[test]
    fn require_web_dir_should_accept_directory_with_index_html() {
        let dir = TempDir::new().expect("tempdir");
        std::fs::write(dir.path().join("index.html"), "<html></html>").expect("write index");
        let resolved = require_web_dir(dir.path()).expect("web dir");
        assert!(resolved.join("index.html").is_file());
    }

    #[test]
    fn resolve_web_dir_should_error_when_explicit_path_is_invalid() {
        let error =
            resolve_web_dir(Some(PathBuf::from("/definitely-not-an-ourboros-webui"))).unwrap_err();
        assert!(error.to_string().contains("not found"));
    }
}
