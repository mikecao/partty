# Partty

A terminal emulator with multiple TTYs.

## Stack

- **Tauri 2** — Rust backend, native webview
- **Vite + TypeScript** — frontend bundler
- **Tailwind CSS v4** — CSS-first config, no PostCSS file
- **xterm.js** — terminal rendering (WebGL renderer with fit, web-links addons)
- **portable-pty** — cross-platform PTY (ConPTY on Windows, openpty on Unix)
- **tauri-plugin-store** — tiny JSON-backed persistence for tab state
- **tauri-plugin-dialog** — native folder picker for new tabs
- **Biome** — lint + format

## Features

- Multiple concurrent terminal tabs, each backed by its own PTY
- "+" opens a native folder picker; the chosen folder is the tab's cwd
- On relaunch, the same tabs reopen with the same initial cwds
- All PTY sessions are killed on tab close, app refresh, and app exit
- Locked dark mode (window theme + pre-paint background, no flash)
- Cross-platform: Windows, macOS, Linux

## Scripts

```bash
pnpm install        # install JS deps
pnpm dev            # run the app in dev mode (cargo + vite + tauri)
pnpm build          # production build + bundle
pnpm vite:dev       # frontend only (no Tauri)
pnpm vite:build     # frontend only
pnpm lint           # Biome lint
pnpm format         # Biome format (writes)
pnpm check          # Biome lint+format with fixes
```

First-time `pnpm dev` will compile the Rust backend — expect several minutes. Subsequent runs are fast.

## Layout

```
partty/
├── src/
│   ├── main.ts                 # entry — kills orphan PTYs, restores tabs
│   ├── state.ts                # load/save tab list via tauri-plugin-store
│   ├── style.css               # Tailwind import + theme tweaks
│   └── terminal/
│       ├── Terminal.ts         # xterm wrapper, PTY event wiring
│       └── TabManager.ts       # tab bar + session state + folder picker
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs              # plugin / handler registration
│   │   └── pty.rs              # PTY session manager + commands
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── biome.json
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## PTY protocol

Frontend ↔ backend bridge:

| Command | Args | Returns |
| --- | --- | --- |
| `pty_spawn` | `shell?`, `args?`, `cwd?`, `env?`, `cols`, `rows` | session `id` (uuid) |
| `pty_write` | `id`, `data` | — |
| `pty_resize` | `id`, `cols`, `rows` | — |
| `pty_kill` | `id` | — |
| `pty_kill_all` | — | — |
| `pty_list` | — | `SessionInfo[]` |

Events emitted by the backend:

- `pty://data/{id}` — utf-8 chunk from the PTY (string payload)
- `pty://exit/{id}` — child exit, payload is `Option<u32>` exit code

## Persistence

Tab state is stored as JSON via `tauri-plugin-store` at `partty.json` in the app data dir. The only thing persisted is the list of tabs and each tab's initial cwd:

```json
{
  "tabs": [
    { "cwd": "E:\\dev\\dream" },
    { "cwd": "E:\\dev\\astrofox" }
  ]
}
```

Each tab persists the cwd it was **created** with, not where the shell has wandered to.

## License

MIT — see [LICENSE.md](LICENSE.md).
