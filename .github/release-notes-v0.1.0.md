## Partty v0.1.0 — Initial Release

A small, fast terminal emulator with multiple TTYs. Built on Tauri 2 + xterm.js.

### Features

- Multiple concurrent terminal tabs, each backed by its own native PTY (ConPTY on Windows, openpty on macOS/Linux)
- Pick a folder when you open a new tab — the shell starts in that directory
- Tabs are persistent: close the app and your tab list + working directories come back when you relaunch
- Drag-and-drop to reorder tabs; the other tabs animate out of the way
- Locked dark mode, no flash on launch
- Webgl-rendered terminal for smooth rendering

### Downloads

Grab the build for your platform from the assets below:

| Platform | Asset |
| --- | --- |
| Windows | `Partty_0.1.0_x64-setup.exe` or `Partty_0.1.0_x64_en-US.msi` |
| macOS (Apple Silicon) | `Partty_0.1.0_aarch64.dmg` |
| macOS (Intel) | `Partty_0.1.0_x64.dmg` |
| Linux | `partty_0.1.0_amd64.deb`, `partty-0.1.0-1.x86_64.rpm`, or `Partty_0.1.0_amd64.AppImage` |

> **Note**: this is an unsigned build. Windows SmartScreen will warn the first time you run it, and macOS will require right-click → Open to bypass Gatekeeper.

### Source

See the [README](https://github.com/mikecao/partty/blob/v0.1.0/README.md) for build-from-source instructions.
