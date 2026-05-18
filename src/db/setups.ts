import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:partty.db";

export interface PaneRow {
  id?: number;
  setup_id?: number;
  title: string | null;
  cwd: string | null;
  shell: string | null;
  args: string | null;
  env: string | null;
  position: number;
}

export interface SetupRow {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface SetupPane {
  title?: string;
  cwd?: string;
  shell?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface Setup {
  id: number;
  name: string;
  panes: SetupPane[];
}

let dbPromise: Promise<Database> | null = null;

function db(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_URL);
  return dbPromise;
}

export async function listSetups(): Promise<SetupRow[]> {
  const conn = await db();
  return await conn.select<SetupRow[]>(
    "SELECT id, name, created_at, updated_at FROM setups ORDER BY name",
  );
}

export async function loadSetup(id: number): Promise<Setup | null> {
  const conn = await db();
  const rows = await conn.select<SetupRow[]>(
    "SELECT id, name, created_at, updated_at FROM setups WHERE id = $1",
    [id],
  );
  if (rows.length === 0) return null;
  const setup = rows[0];
  const panes = await conn.select<PaneRow[]>(
    "SELECT * FROM setup_panes WHERE setup_id = $1 ORDER BY position",
    [id],
  );
  return {
    id: setup.id,
    name: setup.name,
    panes: panes.map((p) => ({
      title: p.title ?? undefined,
      cwd: p.cwd ?? undefined,
      shell: p.shell ?? undefined,
      args: p.args ? (JSON.parse(p.args) as string[]) : undefined,
      env: p.env ? (JSON.parse(p.env) as Record<string, string>) : undefined,
    })),
  };
}

export async function saveSetup(name: string, panes: SetupPane[]): Promise<number> {
  const conn = await db();
  const now = Date.now();
  const result = await conn.execute(
    `INSERT INTO setups (name, created_at, updated_at) VALUES ($1, $2, $2)
     ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at`,
    [name, now],
  );
  const idRows = await conn.select<{ id: number }[]>("SELECT id FROM setups WHERE name = $1", [
    name,
  ]);
  const setupId = idRows[0]?.id ?? Number(result.lastInsertId);
  await conn.execute("DELETE FROM setup_panes WHERE setup_id = $1", [setupId]);
  for (let i = 0; i < panes.length; i++) {
    const p = panes[i];
    await conn.execute(
      `INSERT INTO setup_panes (setup_id, title, cwd, shell, args, env, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        setupId,
        p.title ?? null,
        p.cwd ?? null,
        p.shell ?? null,
        p.args ? JSON.stringify(p.args) : null,
        p.env ? JSON.stringify(p.env) : null,
        i,
      ],
    );
  }
  return setupId;
}

export async function deleteSetup(id: number): Promise<void> {
  const conn = await db();
  await conn.execute("DELETE FROM setups WHERE id = $1", [id]);
}
