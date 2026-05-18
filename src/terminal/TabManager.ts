import { open } from "@tauri-apps/plugin-dialog";
import { loadTabs, type PersistedTab, saveTabs } from "../state";
import { PartyTerminal, type SpawnOpts } from "./Terminal";

const TAB_WIDTH = 144;
const TAB_DRAG_THRESHOLD = 4;

interface Tab {
  id: number;
  cwd: string | null;
  terminal: PartyTerminal;
  pane: HTMLDivElement;
  tabEl: HTMLButtonElement;
  label: HTMLSpanElement;
}

interface DragState {
  tabId: number;
  pointerId: number;
  initialIndex: number;
  currentIndex: number;
  startX: number;
  currentX: number;
  moved: boolean;
}

export class TabManager {
  private root: HTMLElement;
  private tabBar: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs: Tab[] = [];
  private activeId: number | null = null;
  private nextId = 1;
  private drag: DragState | null = null;
  private suppressClickFor: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.tabBar = document.createElement("div");
    this.tabBar.className = "flex items-stretch bg-[#1f1f1f] border-b border-black/40 select-none";

    const newBtn = document.createElement("button");
    newBtn.className = "px-3 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 text-sm";
    newBtn.textContent = "+";
    newBtn.title = "New tab — pick a folder";
    newBtn.addEventListener("click", () => void this.promptAndOpen());

    this.body = document.createElement("div");
    this.body.className = "flex-1 relative";

    this.root.append(this.tabBar, this.body);
    this.tabBar.append(newBtn);
  }

  async restore(): Promise<void> {
    const saved = await loadTabs();
    if (saved.length === 0) {
      await this.newTab({});
      return;
    }
    for (const t of saved) {
      await this.newTab({ cwd: t.cwd ?? undefined });
    }
  }

  private async promptAndOpen(): Promise<void> {
    const picked = await open({ directory: true, multiple: false, title: "Pick a folder" });
    if (typeof picked !== "string") return;
    await this.newTab({ cwd: picked });
  }

  async newTab(opts: SpawnOpts = {}): Promise<number> {
    const id = this.nextId++;
    const pane = document.createElement("div");
    pane.className = "absolute inset-0 p-2 hidden";
    this.body.append(pane);

    const terminal = new PartyTerminal(pane);

    const tabEl = document.createElement("button");
    tabEl.className =
      "shrink-0 w-36 px-3 py-1.5 text-sm hover:bg-white/5 border-r border-black/40 flex items-center justify-between gap-2 transition-transform duration-150 ease-out will-change-transform";
    const label = document.createElement("span");
    label.className = "truncate";
    label.textContent = labelFor(opts.cwd, id);
    label.title = opts.cwd ?? "";
    const close = document.createElement("span");
    close.dataset.tabClose = "true";
    close.textContent = "×";
    close.className = "text-zinc-500 hover:text-zinc-100 px-1 -mx-1";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.closeTab(id);
    });
    close.addEventListener("pointerdown", (e) => {
      // Don't initiate a drag when clicking the close X.
      e.stopPropagation();
    });
    tabEl.append(label, close);
    tabEl.addEventListener("click", () => {
      if (this.suppressClickFor === id) {
        this.suppressClickFor = null;
        return;
      }
      this.activate(id);
    });
    this.attachDrag(tabEl, id);

    // Insert before the "+" button (always last).
    this.tabBar.insertBefore(tabEl, this.tabBar.lastElementChild);

    const tab: Tab = {
      id,
      cwd: opts.cwd ?? null,
      terminal,
      pane,
      tabEl,
      label,
    };
    this.tabs.push(tab);
    this.activate(id);

    await terminal.spawn(opts);
    terminal.focus();
    void this.persist();
    return id;
  }

  activate(id: number) {
    this.activeId = id;
    for (const t of this.tabs) {
      const active = t.id === id;
      t.pane.classList.toggle("hidden", !active);
      t.tabEl.classList.toggle("bg-zinc-950", active);
      t.tabEl.classList.toggle("text-zinc-400", !active);
      t.tabEl.classList.toggle("text-white", active);
      if (active) {
        t.terminal.fitNow();
        t.terminal.focus();
      }
    }
  }

  async closeTab(id: number) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [tab] = this.tabs.splice(idx, 1);
    await tab.terminal.dispose();
    tab.pane.remove();
    tab.tabEl.remove();
    if (this.activeId === id) {
      const next = this.tabs[idx] ?? this.tabs[idx - 1];
      if (next) this.activate(next.id);
      else this.activeId = null;
    }
    void this.persist();
  }

  private attachDrag(tabEl: HTMLButtonElement, id: number): void {
    // Block native HTML5 drag (so it doesn't fight with pointer events).
    tabEl.addEventListener("dragstart", (e) => e.preventDefault());

    tabEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.dataset.tabClose === "true") return;

      const initialIndex = this.tabs.findIndex((t) => t.id === id);
      if (initialIndex < 0) return;

      tabEl.setPointerCapture(e.pointerId);
      this.drag = {
        tabId: id,
        pointerId: e.pointerId,
        initialIndex,
        currentIndex: initialIndex,
        startX: e.clientX,
        currentX: e.clientX,
        moved: false,
      };
    });

    tabEl.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!d || d.tabId !== id || d.pointerId !== e.pointerId) return;

      const offset = e.clientX - d.startX;
      const moved = d.moved || Math.abs(offset) >= TAB_DRAG_THRESHOLD;
      const maxLeft = -d.initialIndex * TAB_WIDTH;
      const maxRight = (this.tabs.length - 1 - d.initialIndex) * TAB_WIDTH;
      const clamped = Math.min(Math.max(offset, maxLeft), maxRight);
      const nextIndex = moved
        ? clamp(
            Math.round((d.initialIndex * TAB_WIDTH + clamped) / TAB_WIDTH),
            0,
            this.tabs.length - 1,
          )
        : d.initialIndex;

      if (d.currentX === e.clientX && d.currentIndex === nextIndex && d.moved === moved) {
        return;
      }

      d.currentX = e.clientX;
      d.currentIndex = nextIndex;
      d.moved = moved;
      this.applyDragTransforms();
    });

    const finish = (e: PointerEvent, commit: boolean) => {
      const d = this.drag;
      if (!d || d.tabId !== id || d.pointerId !== e.pointerId) return;

      if (tabEl.hasPointerCapture(e.pointerId)) {
        tabEl.releasePointerCapture(e.pointerId);
      }

      const shouldReorder = commit && d.moved && d.initialIndex !== d.currentIndex;
      const wasDragging = d.moved;
      this.drag = null;

      if (shouldReorder) {
        this.commitReorder(d.initialIndex, d.currentIndex);
      } else {
        this.clearTransforms();
      }

      if (wasDragging) {
        // Suppress the synthetic click that follows pointerup so we don't
        // re-activate the tab the user just dropped.
        this.suppressClickFor = id;
      }
    };

    tabEl.addEventListener("pointerup", (e) => finish(e, true));
    tabEl.addEventListener("pointercancel", (e) => finish(e, false));
    tabEl.addEventListener("lostpointercapture", (e) => finish(e, true));
  }

  private applyDragTransforms(): void {
    const d = this.drag;
    if (!d) return;

    for (let i = 0; i < this.tabs.length; i++) {
      const t = this.tabs[i];
      let dx = 0;

      if (t.id === d.tabId) {
        if (d.moved) {
          const offset = d.currentX - d.startX;
          const maxLeft = -d.initialIndex * TAB_WIDTH;
          const maxRight = (this.tabs.length - 1 - d.initialIndex) * TAB_WIDTH;
          dx = Math.min(Math.max(offset, maxLeft), maxRight);
        }
        t.tabEl.style.transition = "none";
        t.tabEl.style.zIndex = "10";
      } else if (d.moved) {
        if (d.initialIndex < d.currentIndex && i > d.initialIndex && i <= d.currentIndex) {
          dx = -TAB_WIDTH;
        } else if (d.initialIndex > d.currentIndex && i >= d.currentIndex && i < d.initialIndex) {
          dx = TAB_WIDTH;
        }
        t.tabEl.style.transition = "";
        t.tabEl.style.zIndex = "";
      }

      t.tabEl.style.transform = `translateX(${dx}px)`;
    }
  }

  private clearTransforms(): void {
    for (const t of this.tabs) {
      t.tabEl.style.transform = "";
      t.tabEl.style.transition = "";
      t.tabEl.style.zIndex = "";
    }
  }

  private commitReorder(fromIdx: number, toIdx: number): void {
    // Clear transforms FIRST so DOM reordering doesn't visually conflict.
    this.clearTransforms();

    const [moved] = this.tabs.splice(fromIdx, 1);
    this.tabs.splice(toIdx, 0, moved);

    // Reflow the DOM. The "+" button is always the last child.
    const plus = this.tabBar.lastElementChild;
    for (const t of this.tabs) {
      this.tabBar.insertBefore(t.tabEl, plus);
    }

    void this.persist();
  }

  private async persist(): Promise<void> {
    const snapshot: PersistedTab[] = this.tabs.map((t) => ({ cwd: t.cwd }));
    await saveTabs(snapshot);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function labelFor(cwd: string | null | undefined, id: number): string {
  if (!cwd) return `tty ${id}`;
  const seg = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  return seg[seg.length - 1] || cwd;
}
