import { open } from "@tauri-apps/plugin-dialog";
import { loadSessions, type SessionEntry, saveSessions } from "../state";

const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

interface SettingsCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
}

export class SettingsView {
  private overlay: HTMLDivElement;
  private listEl: HTMLDivElement;
  private sessions: SessionEntry[] = [];
  private readonly callbacks: SettingsCallbacks;

  constructor(container: HTMLElement, callbacks: SettingsCallbacks = {}) {
    this.callbacks = callbacks;

    this.overlay = document.createElement("div");
    this.overlay.className = "absolute inset-0 z-20 hidden overflow-y-auto bg-zinc-950";

    const content = document.createElement("div");
    content.className = "mx-auto max-w-2xl px-6 py-8";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between gap-4";
    const title = document.createElement("h1");
    title.className = "text-lg font-semibold text-zinc-100";
    title.textContent = "Settings";
    const doneBtn = document.createElement("button");
    doneBtn.className =
      "rounded-md bg-white/10 px-4 py-1.5 text-sm text-zinc-100 hover:bg-white/15";
    doneBtn.textContent = "Done";
    doneBtn.addEventListener("click", () => this.close());
    header.append(title, doneBtn);

    const subtitle = document.createElement("p");
    subtitle.className = "mt-1 text-sm text-zinc-500";
    subtitle.textContent = "These terminal sessions open automatically when Partty starts.";

    const section = document.createElement("h2");
    section.className = "mt-6 text-xs font-semibold tracking-wider text-zinc-500 uppercase";
    section.textContent = "Startup sessions";

    this.listEl = document.createElement("div");

    const addBtn = document.createElement("button");
    addBtn.className =
      "mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200";
    addBtn.textContent = "+ Add session…";
    addBtn.addEventListener("click", () => void this.addSession());

    content.append(header, subtitle, section, this.listEl, addBtn);
    this.overlay.append(content);
    container.append(this.overlay);
  }

  get isOpen(): boolean {
    return !this.overlay.classList.contains("hidden");
  }

  async toggle(): Promise<void> {
    if (this.isOpen) {
      this.close();
      return;
    }
    await this.open();
  }

  async open(): Promise<void> {
    if (this.isOpen) return;
    this.sessions = await loadSessions();
    this.render();
    this.overlay.classList.remove("hidden");
    window.addEventListener("keydown", this.onKeyDown);
    this.callbacks.onOpen?.();
  }

  close(): void {
    if (!this.isOpen) return;
    this.overlay.classList.add("hidden");
    window.removeEventListener("keydown", this.onKeyDown);
    this.callbacks.onClose?.();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.close();
  };

  private async addSession(): Promise<void> {
    const picked = await open({ directory: true, multiple: false, title: "Pick a folder" });
    if (typeof picked !== "string") return;
    this.sessions.push({ id: crypto.randomUUID(), cwd: picked, enabled: true });
    await this.persistAndRender();
  }

  private async removeSession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    await this.persistAndRender();
  }

  private async setEnabled(id: string, enabled: boolean): Promise<void> {
    const entry = this.sessions.find((s) => s.id === id);
    if (!entry) return;
    entry.enabled = enabled;
    await this.persistAndRender();
  }

  private async move(id: string, dir: -1 | 1): Promise<void> {
    const idx = this.sessions.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= this.sessions.length) return;
    const [entry] = this.sessions.splice(idx, 1);
    this.sessions.splice(target, 0, entry);
    await this.persistAndRender();
  }

  private async persistAndRender(): Promise<void> {
    await saveSessions(this.sessions);
    this.render();
  }

  private render(): void {
    this.listEl.replaceChildren();
    if (this.sessions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "py-10 text-center text-sm text-zinc-500";
      empty.textContent = "No startup sessions yet — add one to open it automatically on launch.";
      this.listEl.append(empty);
      return;
    }
    for (let i = 0; i < this.sessions.length; i++) {
      this.listEl.append(this.renderRow(this.sessions[i], i));
    }
  }

  private renderRow(s: SessionEntry, index: number): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "flex items-center gap-3 border-b border-white/5 py-3";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "relative inline-flex shrink-0 cursor-pointer items-center";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "peer sr-only";
    checkbox.checked = s.enabled;
    checkbox.setAttribute("aria-label", `Open ${folderName(s.cwd)} on startup`);
    checkbox.addEventListener("change", () => void this.setEnabled(s.id, checkbox.checked));
    const track = document.createElement("div");
    track.className =
      "relative h-5 w-9 rounded-full bg-zinc-700 transition-colors after:absolute after:content-[''] after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-4";
    toggleLabel.append(checkbox, track);

    const info = document.createElement("div");
    info.className = "min-w-0 flex-1";
    const name = document.createElement("div");
    name.className = `truncate text-sm font-medium ${s.enabled ? "text-zinc-100" : "text-zinc-500"}`;
    name.textContent = folderName(s.cwd);
    const path = document.createElement("div");
    path.className = "truncate text-xs text-zinc-500";
    path.textContent = s.cwd ?? "Default (home directory)";
    path.title = s.cwd ?? "";
    info.append(name, path);

    const up = this.iconButton("↑", "Move up", () => void this.move(s.id, -1));
    up.disabled = index === 0;
    const down = this.iconButton("↓", "Move down", () => void this.move(s.id, 1));
    down.disabled = index === this.sessions.length - 1;

    const remove = document.createElement("button");
    remove.className =
      "shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-red-400";
    remove.innerHTML = TRASH_ICON;
    remove.title = "Remove";
    remove.addEventListener("click", () => void this.removeSession(s.id));

    row.append(toggleLabel, info, up, down, remove);
    return row;
  }

  private iconButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className =
      "shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500";
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener("click", onClick);
    return btn;
  }
}

function folderName(cwd: string | null): string {
  if (!cwd) return "Default";
  const seg = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  return seg[seg.length - 1] || cwd;
}
