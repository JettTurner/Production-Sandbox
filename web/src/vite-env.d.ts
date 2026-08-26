/// <reference types="vite/client" />

interface FileSystemWritableFileStream extends WritableStream<Blob | string | BufferSource> {
  write(data: Blob | string | BufferSource): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemFileHandle {
  readonly kind: "file";
  readonly name: string;
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

interface Window {
  showDirectoryPicker?: (options?: FileSystemPickerOptions) => Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?: (options?: FileSystemSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}