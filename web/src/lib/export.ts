import JSZip from "jszip";
import type { FsNode } from "./types";
import { isFileNode } from "./types";

/** Export a planned tree as a .zip containing the empty folder structure. */
export async function zipTree(tree: FsNode[]): Promise<Blob> {
  const zip = new JSZip();

  function addNodes(folder: JSZip, nodes: FsNode[]) {
    for (const node of nodes) {
      if (node.kind === "insert") continue;
      if (isFileNode(node)) {
        folder.file(node.name, "");
      } else {
        addNodes(folder.folder(node.name)!, node.children);
      }
    }
  }

  addNodes(zip, tree);
  return zip.generateAsync({ type: "blob", platform: "DOS" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, filename);
}

// ---------- .fh files via the File System Access API ----------
// Keeping the FileSystemFileHandle lets Ctrl+S write straight back to the file
// that was opened instead of prompting every time.

const FH_TYPES = [{ description: "Folder Hierarchy", accept: { "text/plain": [".fh", ".pbkstruct", ".txt"] } }];

export function supportsFilePickers(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window && "showSaveFilePicker" in window;
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === "AbortError";
}

export interface OpenedFile {
  name: string;
  text: string;
  handle: FileSystemFileHandle | null;
}

/** Returns null when the user cancels. Requires supportsFilePickers(). */
export async function pickAndOpenFile(): Promise<OpenedFile | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({ id: "fh-file", types: FH_TYPES });
    const file = await handle.getFile();
    return { name: file.name, text: await file.text(), handle };
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

export async function writeToHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** Save-as dialog. Returns the new handle, or null when the user cancels. */
export async function pickAndSaveFile(text: string, suggestedName: string): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await window.showSaveFilePicker!({
      id: "fh-file",
      suggestedName,
      types: [{ description: "Folder Hierarchy", accept: { "text/plain": [".fh"] } }],
    });
    await writeToHandle(handle, text);
    return handle;
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}
