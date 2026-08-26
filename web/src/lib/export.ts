import JSZip from "jszip";
import type { FsNode } from "./types";

/** Export the resolved tree as a .zip containing the empty folder structure. */
export async function zipTree(tree: FsNode[], zipName: string): Promise<Blob> {
  const zip = new JSZip();

  function addNodes(folder: JSZip, nodes: FsNode[]) {
    for (const node of nodes) {
      if (node.kind === "insert") continue;
      if (node.name.includes(".")) {
        folder.file(node.name, "");
      } else {
        addNodes(folder.folder(node.name)!, node.children);
      }
    }
  }

  addNodes(zip, tree);
  const base = zipName.replace(/\.fh$/i, "");
  return zip.generateAsync({ type: "blob", platform: "DOS" }).then((blob) => {
    // JSZip already produced the blob; nothing to override
    void base;
    return blob;
  });
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

export function supportsSaveFilePicker(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export async function saveFileAs(text: string, filename: string): Promise<boolean> {
  if (!supportsSaveFilePicker()) return false;
  try {
    const handle = await window.showSaveFilePicker!({
      suggestedName: filename,
      types: [{ description: "Folder Hierarchy", accept: { "text/plain": [".fh"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  } catch (err) {
    if ((err as Error).name === "AbortError") return false;
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