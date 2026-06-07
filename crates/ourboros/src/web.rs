use std::path::{Path, PathBuf};

use axum::Router;
use tower_http::services::{ServeDir, ServeFile};
use tracing::warn;

/// True when launched from a packaged macOS `.app` bundle.
pub fn is_macos_app_bundle() -> bool {
    if std::env::var_os("OURBOROS_APP_BUNDLE").is_some_and(|v| !v.is_empty()) {
        return true;
    }

    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let exe = exe.canonicalize().unwrap_or(exe);

    let Some(macos) = exe.parent() else {
        return false;
    };
    if macos.file_name().is_some_and(|name| name != "MacOS") {
        return false;
    }

    macos.join("../Resources/web/index.html").is_file()
}

pub fn resolve_web_dir(cli: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(path) = cli {
        return normalize_web_dir(path);
    }

    if let Ok(raw) = std::env::var("OURBOROS_WEB_DIR") {
        if let Some(path) = normalize_web_dir(PathBuf::from(raw)) {
            return Some(path);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let mut candidates = vec![
                parent.join("web"),
                parent.join("../Resources/web"),
                parent.join("../share/ourboros/web"),
            ];
            if is_macos_app_bundle() {
                candidates.swap(0, 1);
            }
            for candidate in candidates {
                if let Some(path) = normalize_web_dir(candidate) {
                    return Some(path);
                }
            }
        }
    }

    None
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

fn normalize_web_dir(path: PathBuf) -> Option<PathBuf> {
    let canonical = path.canonicalize().unwrap_or(path);
    if canonical.join("index.html").is_file() {
        Some(canonical)
    } else {
        warn!(
            web_dir = %canonical.display(),
            "web directory is missing index.html"
        );
        None
    }
}
