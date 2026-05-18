import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("partty.json", { autoSave: 250, defaults: { tabs: [] } });

export interface PersistedTab {
  cwd: string | null;
}

const KEY = "tabs";

export async function loadTabs(): Promise<PersistedTab[]> {
  const tabs = await store.get<PersistedTab[]>(KEY);
  return Array.isArray(tabs) ? tabs : [];
}

export async function saveTabs(tabs: PersistedTab[]): Promise<void> {
  await store.set(KEY, tabs);
}
