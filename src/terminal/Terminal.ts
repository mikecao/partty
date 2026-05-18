import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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
    try {
      this.xterm.loadAddon(new WebglAddon());
    } catch {
      // webgl not supported; canvas renderer is the fallback
    }
    this.xterm.open(this.container);
    this.fit.fit();
  }

  async spawn(opts: SpawnOpts = {}): Promise<string> {
    const { cols, rows } = this.xterm;
    const id = await invoke<string>("pty_spawn", {
      shell: opts.shell ?? null,
      args: opts.args ?? null,
      cwd: opts.cwd ?? null,
      env: opts.env ?? null,
      cols,
      rows,
    });
    this.sessionId = id;

    this.unlistenData = await listen<string>(`pty://data/${id}`, (e) => {
      this.xterm.write(e.payload);
    });
    this.unlistenExit = await listen<number | null>(`pty://exit/${id}`, () => {
      this.xterm.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
    });

    this.xterm.onData((data) => {
      void invoke("pty_write", { id, data });
    });

    this.xterm.onResize(({ cols, rows }) => {
      void invoke("pty_resize", { id, cols, rows });
    });

    this.resizeObserver = new ResizeObserver(() => this.fit.fit());
    this.resizeObserver.observe(this.container);

    return id;
  }

  focus() {
    this.xterm.focus();
  }

  fitNow() {
    this.fit.fit();
  }

  async dispose() {
    this.resizeObserver?.disconnect();
    this.unlistenData?.();
    this.unlistenExit?.();
    if (this.sessionId) {
      try {
        await invoke("pty_kill", { id: this.sessionId });
      } catch {
        // already gone
      }
    }
    this.xterm.dispose();
  }
}
