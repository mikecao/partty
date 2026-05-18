import { invoke } from "@tauri-apps/api/core";
import "./style.css";
import { TabManager } from "./terminal/TabManager";

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

// Wipe any orphaned PTY sessions left from a previous webview refresh,
// before we restore tabs (which will spawn fresh ones).
await invoke("pty_kill_all").catch(() => {});

// Best-effort kill on refresh / unload. (App-close cleanup is handled by
// PtyManager's Drop impl on the Rust side.)
window.addEventListener("beforeunload", () => {
  void invoke("pty_kill_all");
});

const manager = new TabManager(app);
await manager.restore();
