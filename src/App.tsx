import { X } from "lucide-react";
import { useRef, useState } from "react";
import { SettingsView } from "./settings/SettingsView";
import { type SessionEntry, saveSessions } from "./state";
import { FolderPicker } from "./terminal/FolderPicker";
import { TabBar, type TerminalTab } from "./terminal/TabBar";
import { TerminalPane } from "./terminal/TerminalPane";

interface AppProps {
  startupSessions: SessionEntry[];
  startupError: string | null;
}

export function App({ startupSessions, startupError }: AppProps) {
  const [sessions, setSessions] = useState(startupSessions);
  const [workspace, setWorkspace] = useState<{
    tabs: TerminalTab[];
    activeId: number | null;
    focusRequest: number;
  }>(() => {
    const enabled = startupSessions.filter((session) => session.enabled);
    const tabs: TerminalTab[] = (enabled.length > 0 ? enabled : [{ cwd: null }]).map(
      (session, index) => ({ id: index + 1, cwd: session.cwd }),
    );
    return { tabs, activeId: tabs[tabs.length - 1].id, focusRequest: 0 };
  });
  const nextId = useRef(workspace.tabs.length + 1);
  const saveQueue = useRef(Promise.resolve());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [error, setError] = useState(startupError);

  function newTab(cwd: string | null) {
    const tab = { id: nextId.current++, cwd };
    setWorkspace((current) => ({ ...current, tabs: [...current.tabs, tab], activeId: tab.id }));
    setSettingsOpen(false);
    setPickingFolder(false);
  }

  function cancelPicker() {
    setPickingFolder(false);
    setWorkspace((current) => ({ ...current, focusRequest: current.focusRequest + 1 }));
  }

  function closeSettings() {
    setSettingsOpen(false);
    setWorkspace((current) => ({ ...current, focusRequest: current.focusRequest + 1 }));
  }

  function activate(id: number) {
    setWorkspace((current) => ({
      ...current,
      activeId: id,
      focusRequest: current.focusRequest + 1,
    }));
    setSettingsOpen(false);
  }

  function closeTab(id: number) {
    setWorkspace((current) => {
      const index = current.tabs.findIndex((tab) => tab.id === id);
      if (index < 0) return current;
      const tabs = current.tabs.filter((tab) => tab.id !== id);
      const activeId =
        current.activeId === id
          ? (tabs[index]?.id ?? tabs[index - 1]?.id ?? null)
          : current.activeId;
      return { ...current, tabs, activeId };
    });
  }

  function reorderTab(id: number, targetId: number) {
    setWorkspace((current) => {
      const from = current.tabs.findIndex((tab) => tab.id === id);
      const to = current.tabs.findIndex((tab) => tab.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const tabs = [...current.tabs];
      const [tab] = tabs.splice(from, 1);
      tabs.splice(to, 0, tab);
      return { ...current, tabs };
    });
  }

  function updateSessions(next: SessionEntry[]) {
    setSessions(next);
    // Keep rapid settings changes in order without blocking the UI.
    saveQueue.current = saveQueue.current
      .then(() => saveSessions(next))
      .catch((error: unknown) => setError(`Could not save startup sessions: ${String(error)}`));
  }

  return (
    <>
      <TabBar
        tabs={workspace.tabs}
        activeId={workspace.activeId}
        settingsOpen={settingsOpen}
        pickingFolder={pickingFolder}
        onActivate={activate}
        onClose={closeTab}
        onReorder={reorderTab}
        onNewTab={() => setPickingFolder(true)}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
      />
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 bg-red-950 px-3 py-2 text-sm text-red-200"
        >
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(null)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {workspace.tabs.map((tab) => (
          <TerminalPane
            key={tab.id}
            id={tab.id}
            cwd={tab.cwd}
            active={tab.id === workspace.activeId}
            focusRequest={workspace.focusRequest}
          />
        ))}
      </div>
      {settingsOpen && (
        <SettingsView
          sessions={sessions}
          onChange={updateSessions}
          onOpenSession={newTab}
          onClose={closeSettings}
        />
      )}
      {pickingFolder && <FolderPicker onSelect={newTab} onCancel={cancelPicker} />}
    </>
  );
}
