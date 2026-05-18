use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;

use parking_lot::Mutex;
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum PtyError {
    #[error("pty error: {0}")]
    Io(String),
    #[error("session not found: {0}")]
    NotFound(String),
}

impl serde::Serialize for PtyError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<anyhow::Error> for PtyError {
    fn from(e: anyhow::Error) -> Self {
        PtyError::Io(e.to_string())
    }
}

impl From<std::io::Error> for PtyError {
    fn from(e: std::io::Error) -> Self {
        PtyError::Io(e.to_string())
    }
}

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub id: String,
}

fn default_shell() -> (String, Vec<String>) {
    if cfg!(target_os = "windows") {
        if let Ok(v) = std::env::var("COMSPEC") {
            return (v, vec![]);
        }
        ("powershell.exe".to_string(), vec![])
    } else {
        let sh = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (sh, vec![])
    }
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyManager>,
    shell: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    cols: u16,
    rows: u16,
) -> Result<String, PtyError> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| PtyError::Io(e.to_string()))?;

    let (program, default_args) = match shell {
        Some(s) => (s, vec![]),
        None => default_shell(),
    };
    let mut cmd = CommandBuilder::new(program);
    let argv = args.unwrap_or(default_args);
    for a in argv {
        cmd.arg(a);
    }
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }
    if let Some(map) = env {
        for (k, v) in map {
            cmd.env(k, v);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| PtyError::Io(e.to_string()))?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| PtyError::Io(e.to_string()))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| PtyError::Io(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let session = Session {
        master: pair.master,
        writer,
        child,
    };
    state.sessions.lock().insert(id.clone(), session);

    // Reader thread → emits chunks as utf-8 string events.
    let data_event = format!("pty://data/{id}");
    let exit_event = format!("pty://exit/{id}");
    let sessions_for_exit = Arc::clone(&state.sessions);
    let id_for_exit = id.clone();
    let app_for_exit = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app.emit(&data_event, chunk);
                }
                Err(_) => break,
            }
        }
        // Reap child + emit exit.
        let code: Option<u32> = {
            let mut map = sessions_for_exit.lock();
            map.remove(&id_for_exit)
                .and_then(|mut s| s.child.wait().ok().map(|st| st.exit_code()))
        };
        let _ = app_for_exit.emit(&exit_event, code);
    });

    Ok(id)
}

#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), PtyError> {
    let mut map = state.sessions.lock();
    let session = map.get_mut(&id).ok_or_else(|| PtyError::NotFound(id.clone()))?;
    session.writer.write_all(data.as_bytes())?;
    session.writer.flush()?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), PtyError> {
    let map = state.sessions.lock();
    let session = map.get(&id).ok_or_else(|| PtyError::NotFound(id.clone()))?;
    session
        .master
        .resize(PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| PtyError::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, PtyManager>, id: String) -> Result<(), PtyError> {
    let mut map = state.sessions.lock();
    if let Some(mut session) = map.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}

#[tauri::command]
pub fn pty_list(state: State<'_, PtyManager>) -> Vec<SessionInfo> {
    state
        .sessions
        .lock()
        .keys()
        .cloned()
        .map(|id| SessionInfo { id })
        .collect()
}
