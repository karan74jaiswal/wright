import * as fs from "node:fs";
import * as path from "node:path";

const BLACKLIST_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  ".vscode",
  ".env",
]);

const BLACKLIST_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".avi",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".sqlite",
  ".db",
  ".ico",
  ".svg",
]);

const MAX_DEPTH = 8;
const MAX_FILES = 10000;

export interface ScannerCache {
  files: string[];
  directories: string[];
}

export class WorkspaceScanner {
  private cache: ScannerCache = { files: [], directories: [] };
  private rootDir: string;
  private fileCount = 0;
  private isScanning = false;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  public async init() {
    if (this.initialized) return;
    await this.scan();
    this.startWatcher();
    this.initialized = true;
  }

  public getCache(): ScannerCache {
    return this.cache;
  }

  public async scan() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.fileCount = 0;
    const newCache: ScannerCache = { files: [], directories: [] };

    await this.walk(this.rootDir, 0, newCache);

    this.cache = newCache;
    this.isScanning = false;
  }

  private async walk(currentPath: string, depth: number, cache: ScannerCache) {
    if (depth > MAX_DEPTH) return;
    if (this.fileCount >= MAX_FILES) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch (e) {
      return; // Ignore permission or read errors
    }

    for (const entry of entries) {
      if (this.fileCount >= MAX_FILES) return;
      if (BLACKLIST_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(this.rootDir, fullPath);

      if (entry.isDirectory()) {
        cache.directories.push(relativePath + "/");
        await this.walk(fullPath, depth + 1, cache);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BLACKLIST_EXTS.has(ext)) continue;

        cache.files.push(relativePath);
        this.fileCount++;
      }
    }
  }

  private startWatcher() {
    try {
      this.watcher = fs.watch(
        this.rootDir,
        { recursive: true },
        (_eventType, filename) => {
          if (!filename) return;

          // Ignore blacklisted files/dirs to avoid constant rescans
          const parts = filename.split(path.sep);
          if (parts.some((p) => BLACKLIST_DIRS.has(p))) return;

          const ext = path.extname(filename).toLowerCase();
          if (BLACKLIST_EXTS.has(ext)) return;

          // Debounce rescan
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.scan();
          }, 500);
        },
      );
    } catch (err) {
      console.warn("Failed to start fs.watch, falling back to manual rescans", err);
    }
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  // Phase 1 - Lazy Traversal Function
  public async readDirLazy(targetPath: string): Promise<string[]> {
    const fullTargetPath = path.join(this.rootDir, targetPath);
    // Basic security to ensure it doesn't escape root
    if (!fullTargetPath.startsWith(this.rootDir)) return [];

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(fullTargetPath, {
        withFileTypes: true,
      });
    } catch (e) {
      return [];
    }

    const results: string[] = [];
    for (const entry of entries) {
      if (BLACKLIST_DIRS.has(entry.name)) continue;

      if (entry.isDirectory()) {
        results.push(entry.name + "/");
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BLACKLIST_EXTS.has(ext)) continue;
        results.push(entry.name);
      }
    }
    return results;
  }
}

export const workspaceScanner = new WorkspaceScanner();
