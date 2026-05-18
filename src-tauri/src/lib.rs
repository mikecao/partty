mod pty;

use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:partty.db";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial schema",
        sql: r#"
        CREATE TABLE IF NOT EXISTS setups (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS setup_panes (
            id INTEGER PRIMARY KEY,
            setup_id INTEGER NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
            title TEXT,
            cwd TEXT,
            shell TEXT,
            args TEXT,
            env TEXT,
            position INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .manage(pty::PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
