import { useEffect, useRef } from "react";
import { PartyTerminal } from "./Terminal";

interface TerminalPaneProps {
  id: number;
  cwd: string | null;
  active: boolean;
  focusRequest: number;
}

export function TerminalPane({ id, cwd, active, focusRequest }: TerminalPaneProps) {
  const container = useRef<HTMLElement>(null);
  const terminal = useRef<PartyTerminal | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const instance = new PartyTerminal(container.current);
    terminal.current = instance;
    let cancelled = false;

    void instance.spawn({ cwd: cwd ?? undefined }).catch((error: unknown) => {
      if (!cancelled) {
        instance.xterm.write(`\r\n\x1b[31m[spawn failed] ${String(error)}\x1b[0m\r\n`);
      }
    });

    return () => {
      cancelled = true;
      terminal.current = null;
      void instance.dispose();
    };
  }, [cwd]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit requests also refocus an already-active tab.
  useEffect(() => {
    if (!active) return;
    terminal.current?.fitNow();
    terminal.current?.focus();
  }, [active, focusRequest]);

  return (
    <section
      id={`terminal-${id}`}
      aria-labelledby={`tab-${id}`}
      ref={container}
      className={`absolute inset-0 p-2 ${active ? "" : "hidden"}`}
    />
  );
}
