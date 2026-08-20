import type { FsNode } from "./types";

/**
 * Create the resolved folder tree on disk using the File System Access API.
 * Chrome/Edge only; requires a secure context (localhost or https).
 * Empty "files" (names containing a dot) are created as empty files, matching legacy behavior.
 */
export async function createOnDisk(
  tree: FsNode[],
  picker: () => Promise<FileSystemDirectoryHandle>,
): Promise<{ created: number; target: string }> {
  const dir = await picker();
  let created = 0;

  async function walk(base: FileSystemDirectoryHandle, nodes: FsNode[]) {
    for (const node of nodes) {
      if (node.kind === "insert") continue;
      if (node.name.includes(".")) {
        const handle = await base.getFileHandle(node.name, { create: true });
        // touch the file so it exists on disk immediately
        const writable = await handle.createWritable();
        await writable.close();
      } else {
        const child = await base.getDirectoryHandle(node.name, { create: true });
        await walk(child, node.children);
      }
      created++;
    }
  }

  await walk(dir, tree);
  return { created, target: dir.name };
}

export function supportsFsAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}