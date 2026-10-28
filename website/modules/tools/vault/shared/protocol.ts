// Every request and response after the key exchange is sealed, these are the plaintext shapes

export type TRequest = { n: number; m: string; p?: Record<string, unknown> };

export type TResponse = { n: number; ok: true; r: unknown } | { n: number; ok: false; e: string };

export type TStorage = {
	// Encrypted size on disk, refreshed every few minutes
	vaultBytes: number | null;
	driveTotal: number;
	driveFree: number;
	inboxFiles: number;
	inboxBytes: number;
	pendingFiles: number;
	pendingBytes: number;
};

export type TJob = {
	kind: "inbox" | "pending" | "seed" | "seal";
	stage: "hashing" | "copying" | "verifying" | "sealing" | "decrypting" | "shredding";
	// Relative to the inbox, which is also its place under Android in the vault
	name: string;
	bytes: number;
	total: number;
	startedAt: number;
};

export type TEvent = {
	name: string;
	result: "imported" | "duplicate" | "sealed" | "failed" | "copied";
	size: number;
	at: number;
	// Where it landed in the vault when it was kept under a numbered name
	savedAs?: string;
};

export type TInboxFile = {
	path: string;
	size: number;
	mtime: number;
	// uploading until it sits unchanged for a while, failing after repeated errors
	state: "uploading" | "ready" | "failing";
};

// Top-level folders of the import root copied into the inbox, blocked means a file already has that name
export type TMirror = { created: string[]; existing: number; blocked: string[] };

export type TSearchHit = { path: string; size: number; mtime: number };

export type TActivity = {
	state: "idle" | "importing" | "sealing" | "copying" | "paused" | "waiting";
	current: TJob | null;
	imported: number;
	duplicates: number;
	sealed: number;
	failed: number;
	lastImport: number | null;
	lastError: string | null;
	seed: TSeed | null;
};

export type TSeed = {
	running: boolean;
	done: boolean;
	files: number;
	bytes: number;
	totalFiles: number | null;
	totalBytes: number | null;
	finishedAt: number | null;
};

// Times are "HH:MM" on the server's clock, a window whose end is before its start runs past midnight
export type TWindow = { start: string; end: string };

export type TSchedule = {
	// Empty means the inbox is checked all day
	windows: TWindow[];
	// Whether the inbox is being checked right now
	open: boolean;
	// When the next window opens, null while open or when there are no windows
	nextOpen: number | null;
	timezone: string;
	lastCheck: number | null;
};

export type TStatus = {
	exists: boolean;
	unlocked: boolean;
	authed: boolean;
	// The timeout for this unlock, idleDefault is where every unlock starts
	idleMinutes: number;
	idleDefault: number;
	// Milliseconds until it locks for being unused, null when that can't be tracked
	lockIn?: number | null;
	activity?: TActivity;
	storage?: TStorage;
	schedule?: TSchedule;
	mirror?: TMirrorStatus;
};

// The encrypted vault folder copied to another drive with rsync, it runs whether the vault is locked or not
export type TMirrorStats = {
	files: number;
	regular: number;
	created: number;
	deleted: number;
	transferred: number;
	totalBytes: number;
	transferredBytes: number;
};

export type TMirrorRun = {
	trigger: "scheduled" | "manual" | "checksum";
	startedAt: number;
	finishedAt: number;
	// null when it was cancelled
	ok: boolean | null;
	cancelled?: boolean;
	// Every byte compared rather than size and time
	checksum: boolean;
	error: string | null;
	// Set when it stopped before changing anything, to ask before deleting this many files
	held: { deletes: number; limit: number } | null;
	stats: TMirrorStats | null;
};

export type TMirrorStatus = {
	running: {
		trigger: TMirrorRun["trigger"];
		startedAt: number;
		phase: string;
		checksum: boolean;
		cancelled: boolean;
		// From rsync while copying, rate and eta as rsync prints them
		progress: { bytes: number; percent: number; rate: string; eta: string } | null;
		plan: { files: number; bytes: number; deletes: number } | null;
	} | null;
	last: TMirrorRun | null;
	lastCompleted: TMirrorRun | null;
	lastSuccess: TMirrorRun | null;
	lastChecksum: number | null;
	held: { deletes: number; limit: number } | null;
	nextScheduled: number;
	everyHours: number;
	health: { ok: boolean; reason: string | null };
	source: string;
	dest: string;
};

export type TEntry = {
	name: string;
	dir: boolean;
	size: number;
	mtime: number;
};

export type TListing = { path: string; entries: TEntry[] };

// One encrypted read, bigger files are fetched in parts of this size
export const CHUNK_BYTES = 2 * 1024 * 1024;
export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 256;
// The idle timeout moves in steps within these bounds
export const IDLE_STEP = 5;
export const IDLE_MIN = 5;
export const IDLE_MAX = 240;
export const MAX_WINDOWS = 12;
