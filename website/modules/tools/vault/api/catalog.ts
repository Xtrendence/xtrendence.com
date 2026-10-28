import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { FILES, INDEX_FILE } from "./config";

// Size, modified time and checksum per vault file, so duplicate checks only hash same sized files and only after they change

type TItem = { size: number; mtime: number; hash?: string };
type TSaved = { v: 1; items: Record<string, [number, number, string?]> };

export const TEMP_PREFIX = ".vault-import-";

export async function hashFile(file: string, onBytes?: (bytes: number) => void) {
	const hash = createHash("sha256");
	for await (const chunk of fs.createReadStream(file, { highWaterMark: 8 << 20 })) {
		hash.update(chunk as Buffer);
		onBytes?.((chunk as Buffer).length);
	}
	return hash.digest("hex");
}

export type TWalked = { full: string; rel: string; stats: fs.Stats };

// Depth first, regular files only, symlinks are never followed
export async function* walk(root: string, signal?: AbortSignal, dirs?: (rel: string) => void): AsyncGenerator<TWalked> {
	const stack = [""];
	while (stack.length > 0) {
		const relDir = stack.pop() as string;
		let handle: fs.Dir;
		try {
			handle = await fsp.opendir(path.join(root, relDir));
		} catch {
			continue;
		}
		for await (const entry of handle) {
			if (signal?.aborted) {
				await handle.close().catch(() => {});
				return;
			}
			const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				stack.push(rel);
				dirs?.(rel);
			} else if (entry.isFile()) {
				const full = path.join(root, rel);
				try {
					yield { full, rel, stats: await fsp.lstat(full) };
				} catch {}
			}
		}
	}
}

export class Catalog {
	private items = new Map<string, TItem>();
	private bySize = new Map<number, Set<string>>();
	private dirty = false;
	// Imported while a reconcile walk runs, so the walk may have passed their folder already
	private recent = new Set<string>();
	loaded = false;

	load() {
		this.items.clear();
		this.bySize.clear();
		try {
			const saved = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8")) as TSaved;
			for (const [rel, [size, mtime, hash]] of Object.entries(saved.items)) {
				this.put(rel, { size, mtime, hash });
			}
		} catch {}
		this.loaded = true;
		this.dirty = false;
	}

	unload() {
		this.items.clear();
		this.bySize.clear();
		this.loaded = false;
	}

	async save() {
		if (!this.loaded || !this.dirty) {
			return;
		}
		const items: TSaved["items"] = {};
		for (const [rel, item] of this.items) {
			items[rel] = item.hash ? [item.size, item.mtime, item.hash] : [item.size, item.mtime];
		}
		const temp = `${INDEX_FILE}.${randomBytes(4).toString("hex")}.tmp`;
		await fsp.writeFile(temp, JSON.stringify({ v: 1, items } satisfies TSaved), { mode: 0o600 });
		await fsp.rename(temp, INDEX_FILE);
		this.dirty = false;
	}

	private put(rel: string, item: TItem) {
		this.drop(rel);
		this.items.set(rel, item);
		let set = this.bySize.get(item.size);
		if (!set) {
			set = new Set();
			this.bySize.set(item.size, set);
		}
		set.add(rel);
	}

	private drop(rel: string) {
		const old = this.items.get(rel);
		if (old) {
			this.bySize.get(old.size)?.delete(rel);
			this.items.delete(rel);
		}
	}

	set(rel: string, item: TItem) {
		this.put(rel, item);
		this.recent.add(rel);
		this.dirty = true;
	}

	get(rel: string) {
		return this.items.get(rel);
	}

	// File names only, matched anywhere in the path without case
	search(query: string, limit: number) {
		const needle = query.toLowerCase();
		const hits: { path: string; size: number; mtime: number }[] = [];
		for (const [rel, item] of this.items) {
			if (rel.toLowerCase().includes(needle)) {
				hits.push({ path: rel, size: item.size, mtime: item.mtime });
				if (hits.length >= limit) {
					break;
				}
			}
		}
		return hits;
	}

	sameSize(size: number) {
		return [...(this.bySize.get(size) ?? [])];
	}

	// The cached checksum when the file is unchanged since it was hashed, otherwise a fresh one
	async hashOf(rel: string, stats: fs.Stats, onBytes?: (bytes: number) => void) {
		const mtime = Math.floor(stats.mtimeMs);
		const item = this.items.get(rel);
		if (item?.hash && item.size === stats.size && item.mtime === mtime) {
			return item.hash;
		}
		const hash = await hashFile(path.join(FILES, rel), onBytes);
		this.set(rel, { size: stats.size, mtime, hash });
		return hash;
	}

	// Brings the catalog in line with the files after changes made over Samba, and clears unfinished imports
	async reconcile(signal: AbortSignal) {
		const seen = new Set<string>();
		this.recent.clear();
		for await (const { full, rel, stats } of walk(FILES, signal)) {
			if (path.basename(rel).startsWith(TEMP_PREFIX)) {
				// Left by an import that was cut off, a running import touches its file far more often
				if (Date.now() - stats.ctimeMs > 60 * 60 * 1000) {
					await fsp.rm(full, { force: true }).catch(() => {});
				}
				continue;
			}
			seen.add(rel);
			const mtime = Math.floor(stats.mtimeMs);
			const item = this.items.get(rel);
			if (!item || item.size !== stats.size || item.mtime !== mtime) {
				this.set(rel, { size: stats.size, mtime });
			}
		}
		if (signal.aborted) {
			return;
		}
		for (const rel of [...this.items.keys()]) {
			if (!seen.has(rel) && !this.recent.has(rel)) {
				this.drop(rel);
				this.dirty = true;
			}
		}
		await this.save();
	}
}
