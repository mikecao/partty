use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct DirectoryEntry {
    name: String,
    path: String,
}

#[derive(Serialize)]
pub struct DirectoryListing {
    path: String,
    parent: Option<String>,
    directories: Vec<DirectoryEntry>,
}

#[tauri::command]
pub async fn list_directories(app: AppHandle, path: String) -> Result<DirectoryListing, String> {
    // Directory reads can block on network drives. Keep them off the UI thread.
    tauri::async_runtime::spawn_blocking(move || read_directories(&app, &path))
        .await
        .map_err(|error| error.to_string())?
}

fn read_directories(app: &AppHandle, requested: &str) -> Result<DirectoryListing, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    let path = match requested {
        "" | "~" => home,
        value if value.starts_with("~/") || value.starts_with("~\\") => home.join(&value[2..]),
        value => {
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                home.join(path)
            }
        }
    };
    let path = path
        .canonicalize()
        .map_err(|error| format!("Could not open {}: {error}", display_path(&path)))?;
    let entries = std::fs::read_dir(&path)
        .map_err(|error| format!("Could not read {}: {error}", display_path(&path)))?;
    let mut directories = Vec::new();
    for entry in entries.flatten() {
        let entry_path = entry.path();
        // Follow directory symlinks and junctions, just like the native picker.
        if entry_path.is_dir() {
            directories.push(DirectoryEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: display_path(&entry_path),
            });
        }
    }
    directories.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(DirectoryListing {
        path: display_path(&path),
        parent: path.parent().map(display_path),
        directories,
    })
}

fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy().into_owned();
    // canonicalize uses Windows' extended path syntax; show ordinary paths in
    // the picker and pass them to the shell without the extended prefix.
    #[cfg(windows)]
    {
        if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{unc}");
        }
        if let Some(local) = value.strip_prefix(r"\\?\") {
            return local.to_string();
        }
    }
    value
}
