/// <reference types="vite/client" />

interface FileSystemWritableFileStream extends WritableStream<Blob | string | BufferSource> {
  write(data: Blob | string | BufferSource): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemFileHandle {
  readonly kind: "file";
  readonly name: string;
  queryPermission?(options?: { mode?: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  requestPermission?(options?: { mode?: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
}

interface FileSystemPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: string;
}

interface FileSystemSaveFilePickerOptions extends FileSystemPickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface FileSystemOpenFilePickerOptions extends FileSystemPickerOptions {
  multiple?: boolean;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null>;
}

interface Window {
  showDirectoryPicker?: (options?: FileSystemPickerOptions) => Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker?: (options?: FileSystemOpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: FileSystemSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}
/** App version from web/package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string;
