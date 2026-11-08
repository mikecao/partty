import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as Xterm } from "@xterm/xterm";

export interface SpawnOpts {
  shell?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class PartyTerminal {
  readonly xterm: Xterm;
  private fit = new FitAddon();
  private container: HTMLElement;
  private unlistenData: UnlistenFn | null = null;
  private unlistenExit: UnlistenFn | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private abortController = new AbortController();
  private disposed = false;
  sessionId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.xterm = new Xterm({
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Code", "Roboto Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: "#09090b",
        foreground: "#e4e4e7",
        cursor: "#a1a1aa",
        black: "#27272a",
        brightBlack: "#52525b",
        red: "#f87171",
        brightRed: "#fca5a5",
        green: "#4ade80",
        brightGreen: "#86efac",
        yellow: "#fbbf24",
        brightYellow: "#fcd34d",
        blue: "#60a5fa",
        brightBlue: "#93c5fd",
        magenta: "#c084fc",
        brightMagenta: "#d8b4fe",
        cyan: "#22d3ee",
        brightCyan: "#67e8f9",
        white: "#e4e4e7",
        brightWhite: "#fafafa",
      },
    });
    this.xterm.loadAddon(this.fit);
    this.xterm.loadAddon(new WebLinksAddon());
    this.xterm.open(this.container);
    try {
      this.xterm.loadAddon(new WebglAddon());
    } catch {
      // WebGL is unavailable; keep xterm's default renderer.
    }
    this.xterm.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      const hasShortcutModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (hasShortcutModifier && key === "c") {
        event.preventDefault();
        if (this.xterm.hasSelection()) {
          void this.copySelection();
        } else {
          this.writeToPty("\x03");
        }
        return false;
      }

      if (!hasShortcutModifier || key !== "v") {
        return true;
      }

      event.preventDefault();
      void this.pasteFromClipboard();
      return false;
    });
    this.container.addEventListener(
      "paste",
      (event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.pasteText(text);
      },
      { signal: this.abortController.signal },
    );
    this.fitNow();
  }

  async spawn(opts: SpawnOpts = {}): Promise<string> {
    if (this.disposed) throw new Error("Terminal has been disposed");
    const { cols, rows } = this.xterm;
    const id = await invoke<string>("pty_spawn", {
      shell: opts.shell ?? null,
      args: opts.args ?? null,
      cwd: opts.cwd ?? null,
      env: opts.env ?? null,
      cols,
      rows,
    });
    // A component can unmount while Tauri is still creating its PTY (including
    // React Strict Mode's setup/cleanup cycle). Reap late sessions immediately.
    if (this.disposed) {
      await invoke("pty_kill", { id }).catch(() => {});
      return id;
    }
    this.sessionId = id;

    try {
      const unlistenData = await listen<string>(`pty://data/${id}`, (e) => {
        if (!this.disposed) this.xterm.write(e.payload);
      });
      if (this.disposed) {
        unlistenData();
        return id;
      }
      this.unlistenData = unlistenData;

      const unlistenExit = await listen<number | null>(`pty://exit/${id}`, () => {
        if (this.disposed) return;
        this.sessionId = null;
        this.xterm.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
      });
      if (this.disposed) {
        unlistenExit();
        return id;
      }
      this.unlistenExit = unlistenExit;

      this.xterm.onData((data) => {
        this.writeToPty(data);
      });

      this.xterm.onResize(({ cols, rows }) => {
        if (this.sessionId) {
          void invoke("pty_resize", { id, cols, rows }).catch(() => {});
        }
      });

      this.resizeObserver = new ResizeObserver(() => this.fitNow());
      this.resizeObserver.observe(this.container);
      this.fitNow();
      // The pane may have resized while spawn/listen were pending.
      await invoke("pty_resize", { id, cols: this.xterm.cols, rows: this.xterm.rows }).catch(
        () => {},
      );
    } catch (error) {
      this.unlistenData?.();
      this.unlistenExit?.();
      this.unlistenData = null;
      this.unlistenExit = null;
      this.sessionId = null;
      await invoke("pty_kill", { id }).catch(() => {});
      throw error;
    }

    return id;
  }

  focus() {
    if (!this.disposed) this.xterm.focus();
  }

  fitNow() {
    if (!this.disposed && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
      this.fit.fit();
    }
  }

  private pasteText(text: string) {
    if (this.disposed || text.length === 0) {
      return;
    }

    this.xterm.paste(text);
  }

  private async pasteFromClipboard() {
    try {
      this.pasteText(await readText());
    } catch {
      // Clipboard reads may be unavailable; paste events still work.
    }
  }

  private async copySelection() {
    const selection = this.xterm.getSelection();
    if (selection.length === 0) {
      return;
    }

    try {
      await writeText(selection);
    } catch {
      // Clipboard writes may be unavailable; leave the selection intact.
    }
  }

  private writeToPty(data: string) {
    if (!this.sessionId) {
      return;
    }

    void invoke("pty_write", { id: this.sessionId, data }).catch(() => {});
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.resizeObserver?.disconnect();
    this.unlistenData?.();
    this.unlistenExit?.();
    this.unlistenData = null;
    this.unlistenExit = null;
    const id = this.sessionId;
    this.sessionId = null;
    this.xterm.dispose();
    if (id) {
      try {
        await invoke("pty_kill", { id });
      } catch {
        // already gone
      }
    }
  }
}
