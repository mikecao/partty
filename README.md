# Partty

A clean, fast terminal emulator built for keeping every project's shell within reach. Open a tab, point it at a folder, and your shell starts right there. Pick your startup sessions in Settings and they open the moment Partty launches.

## Features

- **Multiple tabs, one window.** Each tab runs its own independent shell, ready to go from the moment you open it.
- **Open new tabs in any folder.** Hit `+`, pick a directory, and the shell starts there — no `cd` required.
- **Configurable startup sessions.** Open Settings (gear next to `+`) to choose which sessions open on launch — add folders, reorder, disable, or remove them.
- **Drag to reorder.** Rearrange tabs by dragging.
- **Smooth rendering.** Hardware-accelerated output keeps long log streams and `htop`-style UIs fluid.
- **Cross-platform.** Windows, macOS (Apple Silicon and Intel), and Linux.

## Stack

- **Tauri 2** — Rust backend, native webview
- **Vite + TypeScript** — frontend bundler
- **Tailwind CSS v4** — CSS-first config, no PostCSS file
- **xterm.js** — terminal rendering (WebGL renderer with fit, web-links addons)
- **portable-pty** — cross-platform PTY (ConPTY on Windows, openpty on Unix)
- **tauri-plugin-store** — tiny JSON-backed persistence for tab state
- **tauri-plugin-dialog** — native folder picker for new tabs
- **Biome** — lint + format

## Scripts

```bash
pnpm install        # install JS deps
pnpm dev            # run the app in dev mode (cargo + vite + tauri)
pnpm build          # build the local Tauri app (no installer)
pnpm build:release  # build release bundles and installers
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
│   ├── main.ts                 # entry — kills orphan PTYs, opens startup sessions
│   ├── state.ts                # load/save startup session config via tauri-plugin-store
│   ├── style.css               # Tailwind import + theme tweaks
│   ├── settings/
│   │   └── SettingsView.ts     # settings screen — manage startup sessions
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

Settings are stored as JSON via `tauri-plugin-store` at `partty.json` in the app data dir. The only thing persisted is the startup session config, edited from the Settings screen:

```json
{
  "sessions": [
    { "id": "…", "cwd": "E:\\dev\\dream", "enabled": true },
    { "id": "…", "cwd": "E:\\dev\\astrofox", "enabled": false }
  ]
}
```

Disabled sessions stay configured but are skipped on launch. Tabs opened or closed during a session are not persisted — what opens on launch is exactly what's enabled in Settings.

## License

MIT — see [LICENSE.md](LICENSE.md).
