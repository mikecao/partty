# Partty

A terminal emulator with multiple TTYs.

## Stack

- **Tauri 2** — Rust backend, native webview
- **Vite + TypeScript** — frontend bundler
- **Tailwind CSS v4** — CSS-first config, no PostCSS file
- **xterm.js** — terminal rendering (WebGL renderer with fit, web-links addons)
- **portable-pty** — cross-platform PTY (ConPTY on Windows, openpty on Unix)
- **SQLite** via `tauri-plugin-sql` — persistence for named setups
- **Biome** — lint + format

## Features

- Multiple concurrent terminal tabs, each backed by its own PTY
- Save and restore named "setups" — collections of tabs with shell, cwd, args, env
- Locked dark mode
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
│   ├── main.ts                 # entry
│   ├── style.css               # Tailwind import + theme tweaks
│   ├── terminal/
│   │   ├── Terminal.ts         # xterm wrapper, PTY event wiring
│   │   └── TabManager.ts       # tab bar + session state
│   └── db/
│       └── setups.ts           # save/load setups via tauri-plugin-sql
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs              # plugin/handler registration, DB migrations
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
| `pty_list` | — | `SessionInfo[]` |

Events emitted by the backend:

- `pty://data/{id}` — utf-8 chunk from the PTY (string payload)
- `pty://exit/{id}` — child exit, payload is `Option<u32>` exit code

## Database

SQLite at `partty.db` (managed by `tauri-plugin-sql`). Tables:

- `setups` — named layouts (`id`, `name`, `created_at`, `updated_at`)
- `setup_panes` — per-setup pane config (`title`, `cwd`, `shell`, `args`, `env`, `position`)
- `settings` — generic key/value

## License

MIT
