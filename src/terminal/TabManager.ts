import { PartyTerminal, type SpawnOpts } from "./Terminal";

interface Tab {
  id: number;
  title: string;
  terminal: PartyTerminal;
  pane: HTMLDivElement;
  tabEl: HTMLButtonElement;
}

export class TabManager {
  private root: HTMLElement;
  private tabBar: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs: Tab[] = [];
  private activeId: number | null = null;
  private nextId = 1;

  constructor(root: HTMLElement) {
    this.root = root;
    this.tabBar = document.createElement("div");
    this.tabBar.className =
      "flex items-stretch gap-px bg-zinc-900 border-b border-zinc-800 select-none";

    const newBtn = document.createElement("button");
    newBtn.className = "px-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-sm";
    newBtn.textContent = "+";
    newBtn.title = "New tab";
    newBtn.addEventListener("click", () => void this.newTab());

    this.body = document.createElement("div");
    this.body.className = "flex-1 relative";

    this.root.append(this.tabBar, this.body);
    this.tabBar.append(newBtn);
  }

  async newTab(opts: SpawnOpts = {}): Promise<number> {
    const id = this.nextId++;
    const pane = document.createElement("div");
    pane.className = "absolute inset-0 p-2 hidden";
    this.body.append(pane);

    const terminal = new PartyTerminal(pane);

    const tabEl = document.createElement("button");
    tabEl.className =
      "min-w-32 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-r border-zinc-800 flex items-center justify-between gap-2";
    const label = document.createElement("span");
    label.textContent = `tty ${id}`;
    const close = document.createElement("span");
    close.textContent = "×";
    close.className = "text-zinc-500 hover:text-red-400";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.closeTab(id);
    });
    tabEl.append(label, close);
    tabEl.addEventListener("click", () => this.activate(id));

    // Insert before the "+" button (always last).
    this.tabBar.insertBefore(tabEl, this.tabBar.lastElementChild);

    const tab: Tab = { id, title: `tty ${id}`, terminal, pane, tabEl };
    this.tabs.push(tab);
    this.activate(id);

    await terminal.spawn(opts);
    terminal.focus();
    return id;
  }

  activate(id: number) {
    this.activeId = id;
    for (const t of this.tabs) {
      const active = t.id === id;
      t.pane.classList.toggle("hidden", !active);
      t.tabEl.classList.toggle("bg-zinc-950", active);
      t.tabEl.classList.toggle("text-zinc-100", active);
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
  }
}
