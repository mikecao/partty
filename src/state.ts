import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("partty.json", { autoSave: 250, defaults: {} });

export interface SessionEntry {
  id: string;
  cwd: string | null;
  enabled: boolean;
}

const SESSIONS_KEY = "sessions";
const LEGACY_TABS_KEY = "tabs";

export async function loadSessions(): Promise<SessionEntry[]> {
  const sessions = await store.get<SessionEntry[]>(SESSIONS_KEY);
  if (Array.isArray(sessions)) return sessions;

  // One-time migration from the old behaviour, which restored whatever
  // tabs happened to be open when the app last exited.
  const tabs = await store.get<Array<{ cwd: string | null }>>(LEGACY_TABS_KEY);
  if (!Array.isArray(tabs) || tabs.length === 0) return [];

  const migrated: SessionEntry[] = tabs.map((t) => ({
    id: crypto.randomUUID(),
    cwd: t.cwd ?? null,
    enabled: true,
  }));
  await store.set(SESSIONS_KEY, migrated);
  await store.delete(LEGACY_TABS_KEY);
  return migrated;
}

export async function saveSessions(sessions: SessionEntry[]): Promise<void> {
  await store.set(SESSIONS_KEY, sessions);
}
