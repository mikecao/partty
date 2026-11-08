import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronUp, Folder, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../components/Modal";

interface DirectoryEntry {
  name: string;
  path: string;
}

interface DirectoryListing {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
}

interface FolderPickerProps {
  title?: string;
  confirmLabel?: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}

interface DirectoryResult {
  directory: string;
  listing?: DirectoryListing;
  error?: string;
}

export function FolderPicker({
  title = "Open a terminal tab",
  confirmLabel = "Open",
  onSelect,
  onCancel,
}: FolderPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const [value, setValue] = useState("~/");
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const { directory, filter } = parseQuery(value);
  const currentResult = result?.directory === directory ? result : null;
  const listing = currentResult?.listing;
  const folders =
    listing?.directories.filter((entry) =>
      entry.name.toLowerCase().includes(filter.toLowerCase()),
    ) ?? [];
  const exact =
    folders.find((entry) => entry.name === filter) ??
    folders.find((entry) => entry.name.toLowerCase() === filter.toLowerCase());
  const selectedPath = listing
    ? filter === ""
      ? listing.path
      : (exact?.path ?? (folders.length === 1 ? folders[0].path : null))
    : null;

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void invoke<DirectoryListing>("list_directories", { path: directory }).then(
      (listing) => {
        if (!cancelled) setResult({ directory, listing });
      },
      (error: unknown) => {
        if (!cancelled) setResult({ directory, error: String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [directory]);

  function navigate(path: string) {
    setValue(withSeparator(path));
    setBrowseError(null);
    input.current?.focus();
  }

  async function browse() {
    setBrowsing(true);
    setBrowseError(null);
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Pick a folder",
        defaultPath: selectedPath ?? listing?.path,
      });
      if (typeof picked === "string") navigate(picked);
    } catch (error) {
      setBrowseError(`Could not browse folders: ${String(error)}`);
    } finally {
      setBrowsing(false);
    }
  }

  return (
    <Modal labelledBy="folder-picker-title" className="w-[496px] p-4" onClose={onCancel}>
      <h2 id="folder-picker-title" className="sr-only">
        {title}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedPath && !browsing) onSelect(selectedPath);
        }}
      >
        <label htmlFor="folder-path" className="mb-1 block text-sm font-semibold">
          Folder path
        </label>
        <div className="flex gap-2">
          <input
            ref={input}
            id="folder-path"
            type="text"
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-controls="folder-options"
            placeholder="~/"
            className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 font-mono text-sm outline-none focus:border-zinc-500"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && folders.length > 0) {
                event.preventDefault();
                rows.current.get(folders[0].path)?.focus();
              }
            }}
          />
          <button
            type="button"
            disabled={browsing}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
            onClick={() => void browse()}
          >
            <FolderOpen size={14} className="shrink-0" aria-hidden="true" />
            Browse…
          </button>
        </div>
        <div className="mt-2 flex h-56 flex-col overflow-hidden rounded-lg border border-zinc-800">
          <button
            type="button"
            disabled={!listing?.parent || browsing}
            aria-label="Go to parent folder"
            title={listing?.parent ?? undefined}
            className="flex h-8 shrink-0 items-center gap-2 border-b border-zinc-800 px-3 text-zinc-400 hover:bg-white/5 disabled:hover:bg-transparent"
            onClick={() => {
              if (listing?.parent) navigate(listing.parent);
            }}
          >
            <ChevronUp size={16} className="shrink-0" aria-hidden="true" />
            <span className="truncate font-mono text-xs">{listing?.path ?? directory}</span>
          </button>
          <div
            id="folder-options"
            className="min-h-0 flex-1 overflow-y-auto py-1"
            aria-busy={!currentResult}
          >
            {!currentResult ? (
              <p role="status" className="px-3 py-5 text-center text-sm text-zinc-500">
                Loading folders…
              </p>
            ) : currentResult.error ? (
              <p role="alert" className="break-words px-3 py-4 text-sm text-red-400">
                {currentResult.error}
              </p>
            ) : folders.length === 0 ? (
              <p role="status" className="px-3 py-5 text-center text-sm text-zinc-500">
                {filter ? "No matching folders." : "No subfolders. You can open this folder."}
              </p>
            ) : (
              <ul>
                {folders.map((folder, index) => (
                  <li key={folder.path}>
                    <button
                      type="button"
                      title={folder.path}
                      disabled={browsing}
                      className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm font-medium hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
                      ref={(button) => {
                        if (button) rows.current.set(folder.path, button);
                        else rows.current.delete(folder.path);
                      }}
                      onClick={() => navigate(folder.path)}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                        event.preventDefault();
                        const next = folders[index + (event.key === "ArrowDown" ? 1 : -1)];
                        if (next) rows.current.get(next.path)?.focus();
                        else if (event.key === "ArrowUp") input.current?.focus();
                      }}
                    >
                      <Folder size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {browseError && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {browseError}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-white/5"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedPath || browsing}
            className="rounded-lg bg-zinc-200 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function withSeparator(path: string): string {
  if (/[\\/]$/.test(path)) return path;
  return path + (path.includes("\\") || /^[a-z]:/i.test(path) ? "\\" : "/");
}

function parseQuery(value: string): { directory: string; filter: string } {
  if (value === "" || value === "~") return { directory: "~", filter: "" };
  if (/^[a-z]:$/i.test(value)) return { directory: `${value}\\`, filter: "" };
  // UNC share roots cannot be listed through their server name alone.
  if (/^\\\\[^\\]+\\[^\\]+\\?$/.test(value)) return { directory: value, filter: "" };
  const separator = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
  const filter = value.slice(separator + 1);
  if (filter === "." || filter === "..") return { directory: value, filter: "" };
  return { directory: separator < 0 ? "~" : value.slice(0, separator + 1), filter };
}
