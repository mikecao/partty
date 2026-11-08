import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "../components/Modal";
import type { SessionEntry } from "../state";
import { FolderPicker } from "../terminal/FolderPicker";

interface SettingsViewProps {
  sessions: SessionEntry[];
  onChange: (sessions: SessionEntry[]) => void;
  onClose: () => void;
}

const ICON_BUTTON =
  "shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500";

export function SettingsView({ sessions, onChange, onClose }: SettingsViewProps) {
  const [pickingFolder, setPickingFolder] = useState(false);

  function addSession(cwd: string) {
    onChange([...sessions, { id: crypto.randomUUID(), cwd, enabled: true }]);
    setPickingFolder(false);
  }

  function move(id: string, direction: -1 | 1) {
    const index = sessions.findIndex((session) => session.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sessions.length) return;
    const next = [...sessions];
    const [session] = next.splice(index, 1);
    next.splice(target, 0, session);
    onChange(next);
  }

  return (
    <>
      <Modal labelledBy="settings-title" className="w-[672px] p-6" onClose={onClose}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="settings-title" className="text-lg font-semibold text-zinc-100">
            Settings
          </h2>
          <button
            type="button"
            className="rounded-md bg-white/10 px-4 py-1.5 text-sm text-zinc-100 hover:bg-white/15"
            onClick={onClose}
          >
            Done
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          These terminal sessions open automatically when Partty starts.
        </p>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Startup sessions
        </h3>
        <fieldset disabled={pickingFolder} className="min-w-0">
          <legend className="sr-only">Startup sessions</legend>
          {sessions.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No startup sessions yet — add one to open it automatically on launch.
            </p>
          ) : (
            sessions.map((session, index) => (
              <div
                key={session.id}
                className="flex items-center gap-3 border-b border-white/5 py-3"
              >
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={session.enabled}
                    aria-label={`Open ${folderName(session.cwd)} on startup`}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      onChange(
                        sessions.map((entry) =>
                          entry.id === session.id ? { ...entry, enabled } : entry,
                        ),
                      );
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="relative h-5 w-9 rounded-full bg-zinc-700 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-400"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm font-medium ${session.enabled ? "text-zinc-100" : "text-zinc-500"}`}
                  >
                    {folderName(session.cwd)}
                  </div>
                  <div className="truncate text-xs text-zinc-500" title={session.cwd ?? ""}>
                    {session.cwd ?? "Default (home directory)"}
                  </div>
                </div>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  title="Move up"
                  aria-label={`Move ${folderName(session.cwd)} up`}
                  disabled={index === 0}
                  onClick={() => move(session.id, -1)}
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  title="Move down"
                  aria-label={`Move ${folderName(session.cwd)} down`}
                  disabled={index === sessions.length - 1}
                  onClick={() => move(session.id, 1)}
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-red-400"
                  title="Remove"
                  aria-label={`Remove ${folderName(session.cwd)}`}
                  onClick={() => onChange(sessions.filter((entry) => entry.id !== session.id))}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm text-zinc-100 hover:bg-white/15 disabled:opacity-30"
            onClick={() => setPickingFolder(true)}
          >
            <Plus size={14} aria-hidden="true" />
            Add session
          </button>
        </fieldset>
      </Modal>
      {pickingFolder && (
        <FolderPicker
          title="Add startup session"
          confirmLabel="Add session"
          onSelect={addSession}
          onCancel={() => setPickingFolder(false)}
        />
      )}
    </>
  );
}

function folderName(cwd: string | null): string {
  if (!cwd) return "Default";
  const segments = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  return segments[segments.length - 1] || cwd;
}
