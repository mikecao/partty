import { Plus, Settings, X } from "lucide-react";
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";

const TAB_WIDTH = 144;
const TAB_DRAG_THRESHOLD = 4;

export interface TerminalTab {
  id: number;
  cwd: string | null;
}

interface TabBarProps {
  tabs: TerminalTab[];
  activeId: number | null;
  settingsOpen: boolean;
  pickingFolder: boolean;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  onReorder: (id: number, targetId: number) => void;
  onNewTab: () => void;
  onToggleSettings: () => void;
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

export function TabBar({
  tabs,
  activeId,
  settingsOpen,
  pickingFolder,
  onActivate,
  onClose,
  onReorder,
  onNewTab,
  onToggleSettings,
}: TabBarProps) {
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClickFor = useRef<number | null>(null);

  useEffect(() => {
    if (activeId !== null) {
      buttons.current.get(activeId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId]);

  function startDrag(event: PointerEvent<HTMLButtonElement>, id: number) {
    if (event.button !== 0) return;
    const initialIndex = tabs.findIndex((tab) => tab.id === id);
    if (initialIndex < 0) return;

    suppressClickFor.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: DragState = {
      tabId: id,
      pointerId: event.pointerId,
      initialIndex,
      currentIndex: initialIndex,
      startX: event.clientX,
      currentX: event.clientX,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>, id: number) {
    const current = dragRef.current;
    if (!current || current.tabId !== id || current.pointerId !== event.pointerId) return;

    const offset = event.clientX - current.startX;
    const moved = current.moved || Math.abs(offset) >= TAB_DRAG_THRESHOLD;
    const clamped = clamp(
      offset,
      -current.initialIndex * TAB_WIDTH,
      (tabs.length - 1 - current.initialIndex) * TAB_WIDTH,
    );
    const currentIndex = moved
      ? clamp(Math.round(current.initialIndex + clamped / TAB_WIDTH), 0, tabs.length - 1)
      : current.initialIndex;
    const next = { ...current, currentX: event.clientX, currentIndex, moved };
    dragRef.current = next;
    setDrag(next);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, id: number, commit: boolean) {
    const current = dragRef.current;
    if (!current || current.tabId !== id || current.pointerId !== event.pointerId) return;

    // Clear the drag before releasing capture, which can emit another finish event.
    dragRef.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (commit && current.moved && current.initialIndex !== current.currentIndex) {
      const target = tabs[current.currentIndex];
      if (target) onReorder(id, target.id);
    }
    if (current.moved) suppressClickFor.current = id;
  }

  function dragStyle(id: number, index: number): CSSProperties | undefined {
    if (!drag) return undefined;
    let dx = 0;
    if (id === drag.tabId) {
      if (drag.moved) {
        dx = clamp(
          drag.currentX - drag.startX,
          -drag.initialIndex * TAB_WIDTH,
          (tabs.length - 1 - drag.initialIndex) * TAB_WIDTH,
        );
      }
      return { transform: `translateX(${dx}px)`, transition: "none", zIndex: 10 };
    }
    if (drag.moved) {
      if (
        drag.initialIndex < drag.currentIndex &&
        index > drag.initialIndex &&
        index <= drag.currentIndex
      ) {
        dx = -TAB_WIDTH;
      } else if (
        drag.initialIndex > drag.currentIndex &&
        index >= drag.currentIndex &&
        index < drag.initialIndex
      ) {
        dx = TAB_WIDTH;
      }
    }
    return { transform: `translateX(${dx}px)` };
  }

  return (
    <div className="flex min-w-0 select-none items-stretch border-b border-black/40 bg-[#1f1f1f]">
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab, index) => {
          const label = labelFor(tab);
          return (
            <div
              key={tab.id}
              className={`flex w-36 shrink-0 items-center gap-2 rounded-t-sm border-r border-black/40 text-sm transition-transform duration-150 ease-out will-change-transform hover:bg-white/5 ${tab.id === activeId ? "bg-zinc-950 text-white" : "text-zinc-400"}`}
              style={dragStyle(tab.id, index)}
            >
              <button
                type="button"
                id={`tab-${tab.id}`}
                aria-pressed={tab.id === activeId}
                aria-controls={`terminal-${tab.id}`}
                title={tab.cwd ?? ""}
                className="min-w-0 flex-1 touch-none truncate py-1.5 pl-3 text-left"
                ref={(button) => {
                  if (button) buttons.current.set(tab.id, button);
                  else buttons.current.delete(tab.id);
                }}
                onClick={() => {
                  if (suppressClickFor.current === tab.id) {
                    suppressClickFor.current = null;
                    return;
                  }
                  onActivate(tab.id);
                }}
                onDragStart={(event) => event.preventDefault()}
                onPointerDown={(event) => startDrag(event, tab.id)}
                onPointerMove={(event) => moveDrag(event, tab.id)}
                onPointerUp={(event) => finishDrag(event, tab.id, true)}
                onPointerCancel={(event) => finishDrag(event, tab.id, false)}
                onLostPointerCapture={(event) => finishDrag(event, tab.id, true)}
              >
                {label}
              </button>
              <button
                type="button"
                aria-label={`Close ${label}`}
                title="Close tab"
                className="shrink-0 px-2 text-zinc-500 hover:text-zinc-100"
                onClick={() => onClose(tab.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="flex shrink-0 items-center justify-center px-3 text-zinc-400 hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30"
        title="New tab — pick a folder"
        aria-label="New tab — pick a folder"
        disabled={pickingFolder}
        onClick={onNewTab}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`flex shrink-0 items-center justify-center px-3 text-zinc-400 hover:bg-white/5 hover:text-zinc-100 ${settingsOpen ? "bg-white/10 text-zinc-100" : ""}`}
        title="Settings"
        aria-label="Settings"
        aria-pressed={settingsOpen}
        onClick={onToggleSettings}
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function labelFor({ cwd, id }: TerminalTab): string {
  if (!cwd) return `tty ${id}`;
  const segments = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  return segments[segments.length - 1] || cwd;
}
