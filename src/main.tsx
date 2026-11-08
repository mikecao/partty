import { invoke } from "@tauri-apps/api/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadSessions, type SessionEntry } from "./state";
import "./style.css";

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

// Clear orphaned PTYs before mounting any terminal components. This runs once
// per page load, outside React's effect and Fast Refresh lifecycles.
await invoke("pty_kill_all").catch(() => {});

window.addEventListener("beforeunload", () => {
  void invoke("pty_kill_all").catch(() => {});
});

let sessions: SessionEntry[] = [];
let startupError: string | null = null;
try {
  sessions = await loadSessions();
} catch (error) {
  startupError = `Could not load startup sessions: ${String(error)}`;
}

createRoot(app).render(
  <StrictMode>
    <App startupSessions={sessions} startupError={startupError} />
  </StrictMode>,
);
