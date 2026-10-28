# Vault API

The vault service runs on `http://192.168.1.125:7900` and is reachable only from the LAN (`192.168.1.0/24`) and the WireGuard VPN (`10.8.0.0/24`, `172.18.0.0/16`). It is plain HTTP, but after a key exchange every request and response is encrypted and authenticated end to end, so nothing readable crosses the network. The React app at `/` uses exactly the API described here, so a client that implements it can do everything the app can.

- [How the vault works](#how-the-vault-works)
- [Transport and encryption](#transport-and-encryption)
- [HTTP endpoints](#http-endpoints)
- [Methods](#methods)
- [Types](#types)
- [Errors and limits](#errors-and-limits)
- [Implementing a client in Swift](#implementing-a-client-in-swift)

## How the vault works

| Place | What it holds |
|---|---|
| `/media/Seagate/Vault/cipher` | The gocryptfs vault, ciphertext only |
| `/srv/vault` | Where the vault is mounted while unlocked. The API's paths are relative to `/srv/vault/files` |
| `/media/Seagate/Inbox` | The `Inbox` Samba share that FolderSync uploads to |
| `/media/Seagate/Vault/pending` | Uploads that arrived while the vault was locked, encrypted with age |
| `/media/Seagate/Android` | The old phone backup. It is copied into the vault once and never modified or deleted |

- **Unlocking** mounts the vault with the password. The server locks it again once it has gone unused for the idle timeout, and `lock` locks it straight away. Every unlock starts at 30 minutes, and `setIdleTimeout` moves it in 5-minute steps, from 5 to 240, until the next lock. Use means any file operation on the vault, from the Samba share, the explorer, an import or the Android copy, so a long copy into the share keeps it open. Polling `status` doesn't count. gocryptfs also has its own 255-minute timeout, in case the server stops. The password is never stored. It goes to gocryptfs on stdin and nowhere else.
- **The inbox** is checked every 10 seconds. A file counts as fully uploaded once it is unchanged between two checks and at least 30 seconds old. Names that upload tools use for unfinished files (`.tmp`, `.part`, `.partial`, `.crdownload` and similar) are skipped.
  - **While unlocked**, each finished file is imported into `Android/<its path in the inbox>`, then the inbox copy is shredded (`shred -n 1 -u`: one pass of random data, then unlinked).
  - **While locked**, each finished file is encrypted with the age public key into `pending` under a random name, then the inbox copy is shredded. The private key that opens pending files lives inside the vault, so the server can encrypt them but never read them.
  - **After an unlock**, pending files are decrypted and imported the same way, then removed.
- **Import hours** limit when the inbox is checked. With no windows set, it is checked all day. With windows set, for example `00:10` to `00:25` and `12:10` to `12:25` just after FolderSync runs, it is checked every 10 seconds only while a window is open. A window that closes mid-import lets the current file finish, and the rest wait for the next window. Windows use the server's clock, and one whose end is earlier than its start runs past midnight. `checkNow` runs a check straight away whatever the hours. Pending files and the Android folder copy aren't limited by the hours, and import whenever the vault is unlocked. The hours are saved in `/var/lib/vault/schedule.json`, outside the vault, so they apply while it is locked too.
- **One job at a time:** inbox checks, imports, pending imports and the Android copy all run in a single loop, so two never overlap. When the loop is busy, the next check waits for it to finish.
- **Duplicate checks** use SHA-256. An incoming file is hashed only when the vault already holds a file of the same size, and each vault file's hash is cached against its size and modified time. If identical content exists anywhere in the vault, nothing is stored and the inbox copy is still shredded. If a different file already has the same name, the new one is saved beside it as `name (2).ext`. Nothing in the vault is ever overwritten.
- **Imports are verified.** The file is copied to a temporary name while being hashed, synced to disk, read back and hashed again, and only then renamed into place. The inbox copy is shredded only after that.
- **The Android folder copy** runs on the first unlock: a counting pass, then the copy. It mirrors the folder exactly, hidden files and empty folders included, and compares only against the same path. It runs in 20 second slices so new uploads are never held up, and it resumes after a lock or restart, skipping files already copied (same size and modified time). `seed` runs it again to pick up anything new.
- **The `Vault` Samba share** points at `/srv/vault/files` and only exists while the vault is unlocked.

## Transport and encryption

The scheme is the one Beacon uses: X25519 key agreement, HKDF-SHA-256, AES-256-CTR and HMAC-SHA-256 (encrypt then MAC).

### 1. Fetch and pin the server key

`GET /api/key` returns `{ "pub": "<base64, 32 bytes>" }`, the server's long-lived X25519 public key. Pin it the first time and refuse to send the password if it ever changes, unless the user confirms. It only changes when `/var/lib/vault/server-key.json` is recreated. The app shows a fingerprint of it: the first 8 bytes of `SHA-256(pub)` read as a big-endian integer, taken mod 10^12, zero-padded to 12 digits and grouped `4 4 4`.

### 2. Open a session

1. Generate a fresh X25519 key pair for this session.
2. `POST /api/session` with JSON `{ "pub": "<base64 of your 32 byte public key>" }`. The response is `{ "id": "<session id>" }`.
3. Derive the keys:

```
shared   = X25519(your private key, server pub)      reject if all 32 bytes are zero
salt     = SHA-256(your pub || server pub)           raw 32 byte keys, yours first
material = HKDF-SHA-256(ikm: shared, salt: salt, info: "vault v1 session", length: 64)
encKey   = material[0..<32]                          AES-256-CTR
macKey   = material[32..<64]                         HMAC-SHA-256
```

Sessions live in server memory only. They expire after 30 minutes without requests and are forgotten when the service restarts. A request with an unknown session gets HTTP 401: open a new session and log in again.

### 3. Seal and open messages

```
seal(label, plaintext):
  counter    = 12 random bytes || 00 00 00 00        16 byte AES-CTR counter block
  ciphertext = AES-256-CTR(encKey, counter, plaintext)
  tag        = HMAC-SHA-256(macKey, utf8(label) || counter || ciphertext)
  return counter || ciphertext || tag                16 + n + 32 bytes

open(label, sealed):
  split into counter (16), ciphertext, tag (32)
  recompute the tag, compare in constant time, reject on mismatch
  decrypt with AES-256-CTR
```

The counter block is incremented as a 128-bit big-endian number per 16-byte block. Since the low 4 bytes start at zero this matches WebCrypto's `length: 32` and CommonCrypto's `kCCModeCTR` for any message under 64 GiB.

Labels bind each message to its direction and request:

| Message | Label |
|---|---|
| Any request | `c>s` |
| Response to request `n` from `/api/rpc` | `s>c:<n>` |
| Response to request `n` from `/api/read` | `s>c:<n>:data` |

### 4. Requests

Every request body is `seal("c>s", utf8(JSON))` sent with these headers:

```
Content-Type: application/octet-stream
X-Session: <session id>
```

The JSON is `{ "n": <request number>, "m": "<method>", "p": { ...params } }`. `n` starts at 1 and goes up by one with every request in the session. The server rejects any `n` it has seen before, and any `n` more than 1000 below the highest so far, so requests can't be replayed but a few can be in flight at once.

## HTTP endpoints

| Endpoint | Body | Response |
|---|---|---|
| `GET /api/key` | none | JSON `{ pub }` |
| `POST /api/session` | JSON `{ pub }` | JSON `{ id }` |
| `POST /api/rpc` | sealed request | `seal("s>c:<n>", utf8(JSON response))` |
| `POST /api/read` | sealed request with `m: "read"` | `seal("s>c:<n>:data", raw file bytes)` |
| `GET /docs.md` | none | This file |

An RPC response is `{ "n": <n>, "ok": true, "r": <result> }` or `{ "n": <n>, "ok": false, "e": "<message>" }`. Check that `n` matches your request.

HTTP status codes other than 200: `400` for a malformed or replayed request, `401` for an unknown session, `403` for an address outside the LAN and VPN, or a `read` while locked or with bad parameters, `404` for a `read` of a missing file.

## Methods

Every method except `status`, `create`, `unlock` and `logout` needs a logged-in session and an unlocked vault, and otherwise fails with `"Locked"`. A session counts as logged in only for the unlock it logged into: after a lock, by `lock` or the idle timer, every session has to unlock again.

### `status`

No params. Works without logging in.

Returns [`TStatus`](#tstatus). `activity` and `storage` are included only for a logged-in session. Poll it every few seconds to follow progress: `activity.current` is the file being worked on right now.

### `create`

`{ "password": string }`, 12 to 256 characters on one line. Only works while no vault exists.

Creates the vault, mounts it, makes the age key pair (private key inside the vault, public key in `/var/lib/vault/age.pub`) and logs the session in.

Returns `{ "recoveryKey": "xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx" }`. This is the gocryptfs master key. It is shown once and never stored. It opens the vault without the password: `gocryptfs -masterkey=<key> /media/Seagate/Vault/cipher <mountpoint>`, and `gocryptfs -passwd -masterkey=<key> /media/Seagate/Vault/cipher` sets a new password.

### `unlock`

`{ "password": string }`

Mounts the vault if it is locked. If it is already unlocked, for example from another device, the password is checked against the vault instead. Either way the session is logged in. Returns `true`. Fails with `"Wrong password"` or `"Too many wrong passwords, try again later"`.

### `lock`

No params. Waits for the file being imported to finish, saves the checksum cache, then unmounts. If something still has a file open over Samba, it unmounts lazily, finishing as soon as that file closes. Logs out every session. Returns `true`.

### `logout`

No params. Logs this session out without locking. Returns `true`.

### `password`

`{ "current": string, "next": string }`. `next` must be 12 to 256 characters on one line.

Changes the vault password. Only the wrapped master key in `gocryptfs.conf` changes, so it is instant whatever the vault's size, and the recovery key keeps working. Returns `true`. A wrong `current` counts towards the lockout.

### `list`

`{ "path": string }`, relative to the vault root, with `""` for the root, `/` as separator and no `.` or `..`.

Returns [`TListing`](#tlisting): folders first, then files, sorted by name in natural order. Fails with `"Not found"` or `"Bad path"`.

### `stat`

`{ "path": string }`

Returns `{ "path": string, "dir": boolean, "size": number, "mtime": number }`.

### `read` (on `/api/read`)

`{ "path": string, "offset": number, "length": number }`, where `length` is at most 2 MiB (`2097152`).

The response opens to the raw bytes at that offset. It is shorter than `length` at the end of the file, and empty past it. To fetch a whole file, request `ceil(size / 2097152)` parts, a few at a time. The app keeps three in flight.

### `search`

`{ "query": string, "limit"?: number }`. `query` needs at least 2 characters, `limit` defaults to 200, maximum 1000.

Matches the query anywhere in the path, ignoring case, using the checksum cache, which is brought up to date with a full scan after each unlock. Returns [`TSearchHit[]`](#tsearchhit).

### `inbox`

No params. Returns [`TInboxFile[]`](#tinboxfile) as of the last check, sorted by path. That is at most 10 seconds old while the inbox is being checked, and from the last window otherwise (see `schedule.lastCheck`).

### `events`

`{ "limit"?: number }`, default 50, maximum 200.

Returns [`TEvent[]`](#tevent), newest first. These are kept in memory and start empty when the service restarts. Seed files appear only when actually copied, not when skipped.

### `schedule`

No params. Returns [`TSchedule`](#tschedule). It is also part of `status` for a logged-in session.

### `setSchedule`

`{ "windows": [{ "start": "HH:MM", "end": "HH:MM" }, ...] }`, up to 12 windows, using the 24-hour clock. A window's start and end must differ. Send `[]` to unset the hours and check all day. This replaces every window, so to add or remove one, send the whole new list.

Returns the new [`TSchedule`](#tschedule), with windows sorted by start time. Fails with `"Times must look like 00:10"`, `"A window needs different start and end times"` or `"Set up to 12 windows"`.

### `checkNow`

No params. Checks the inbox on the next two passes of the loop (a file has to look the same twice to count as uploaded), whatever the hours say. If the loop is busy, the checks run once it finishes. Returns `true`.

### `seed`

No params. Runs the Android folder copy again, copying anything new or changed and never touching the original. Returns `false` if the folder doesn't exist.

### `setIdleTimeout`

`{ "minutes": number }`. Sets the idle timeout for this unlock only, clamped to 5 to 240 and rounded to a whole minute. It also counts as use, so the countdown starts again from the new value. The next unlock starts at `idleDefault` again.

Returns `{ "minutes": number, "lockIn": number | null }`.

### `mirrorFolders`

No params. Creates every top-level folder of `Android/` in the vault as an empty folder in the inbox, so uploads have the same folders to land in. It only goes one level deep, skips folders whose names start with a dot and never deletes or renames anything on either side. It's safe to run any number of times.

Returns [`TMirror`](#tmirror).

### `mirror`

No params. Returns [`TMirrorStatus`](#tmirrorstatus), the state of the backup mirror. The mirror copies the encrypted vault folder (`/media/Seagate/Vault/`, ciphertext and sealed uploads) to `/media/12TB/Vault Backup/` with rsync every 8 hours, whether the vault is locked or not. It mirrors: files gone from the vault are removed from the copy, after everything else has copied. Normal runs compare size and modified time, and one run a week compares every byte.

Before changing anything, each run rehearses. If it would delete more than 5% of the copy's files (at least 200), it changes nothing and sets `held`, which stays until a run is approved. The real run is also capped at that many deletes.

### `mirrorSync`

`{ "checksum"?: boolean, "approve"?: number }`, both optional. Starts a run now. `checksum: true` compares every byte. `approve` is the `held.deletes` count you showed the user: the run may then delete up to that many files, and if it would delete more it is held again. Returns [`TMirrorStatus`](#tmirrorstatus). Fails with `"The vault mirror is already running"`.

### `mirrorCancel`

No params. Stops the running sync. rsync leaves only whole files behind, and nothing is deleted from a run that didn't finish copying. Returns [`TMirrorStatus`](#tmirrorstatus). Fails with `"The vault mirror is not running"`.

## Types

Times are Unix milliseconds. Sizes are bytes.

### TStatus

```ts
{
  exists: boolean;        // a vault has been created
  unlocked: boolean;      // the vault is mounted, by anyone
  authed: boolean;        // this session may use the vault
  idleMinutes: number;    // the idle timeout for this unlock
  idleDefault: number;    // where every unlock starts, 30
  lockIn?: number | null; // logged in only: ms until it locks if unused, null if use can't be tracked
  activity?: TActivity;   // logged in only
  storage?: TStorage;     // logged in only
  schedule?: TSchedule;   // logged in only
  mirror?: TMirrorStatus; // logged in only
}
```

### TSchedule

```ts
{
  windows: { start: string; end: string }[];  // "HH:MM", empty means all day
  open: boolean;                              // the inbox is being checked now
  nextOpen: number | null;                    // when the next window opens, null while open or unset
  timezone: string;                           // the server's, which the times use
  lastCheck: number | null;                   // when the inbox was last checked
}
```

### TActivity

```ts
{
  state: "idle" | "importing" | "sealing" | "copying" | "paused" | "waiting";  // waiting: outside import hours
  current: TJob | null;
  imported: number;       // counts since the service started
  duplicates: number;
  sealed: number;
  failed: number;
  lastImport: number | null;
  lastError: string | null;
  seed: TSeed | null;     // null when there is no Android folder
}
```

### TJob

```ts
{
  kind: "inbox" | "pending" | "seed" | "seal";
  stage: "hashing" | "copying" | "verifying" | "sealing" | "decrypting" | "shredding";
  name: string;           // path relative to the inbox, or to the Android folder for seed
  bytes: number;          // done in the current stage, which starts again from 0
  total: number;          // the file's size
  startedAt: number;
}
```

### TSeed

```ts
{
  running: boolean;
  done: boolean;
  files: number;              // processed so far in this pass, copied or skipped
  bytes: number;
  totalFiles: number | null;  // null while counting
  totalBytes: number | null;
  finishedAt: number | null;
}
```

### TStorage

```ts
{
  vaultBytes: number | null;  // the encrypted folder on disk, refreshed every 5 minutes
  driveTotal: number;
  driveFree: number;
  inboxFiles: number;
  inboxBytes: number;
  pendingFiles: number;       // sealed while locked, waiting for an unlock
  pendingBytes: number;
}
```

### TListing

```ts
{ path: string; entries: { name: string; dir: boolean; size: number; mtime: number }[] }
```

### TInboxFile

```ts
{
  path: string;
  size: number;
  mtime: number;
  state: "uploading" | "ready" | "failing";  // failing after 3 errors, retried after a restart
}
```

### TEvent

```ts
{
  name: string;
  result: "imported" | "duplicate" | "sealed" | "failed" | "copied";
  size: number;
  at: number;
  savedAs?: string;       // vault path when it was saved under a numbered name
}
```

### TMirror

```ts
{
  created: string[];   // folders created in the inbox this time, sorted
  existing: number;    // folders the inbox already had
  blocked: string[];   // names where the inbox has a file instead, left alone
}
```

### TMirrorStatus

Poll it every few seconds while `running` is set, it updates as rsync reports progress.

```ts
{
  running: {
    trigger: "scheduled" | "manual" | "checksum";
    startedAt: number;
    phase: string;          // "Checking the drives", "Comparing", "Comparing checksums", "Copying", "Finishing", "Cancelling"
    checksum: boolean;      // comparing every byte
    cancelled: boolean;
    progress: { bytes: number; percent: number; rate: string; eta: string } | null;  // rate and eta as rsync prints them, like "38.12MB/s" and "0:42:10"
    plan: { files: number; bytes: number; deletes: number } | null;                  // what this run will copy and remove
  } | null;
  last: TMirrorRun | null;           // the newest run, cancelled ones included
  lastCompleted: TMirrorRun | null;  // the newest run that wasn't cancelled
  lastSuccess: TMirrorRun | null;
  lastChecksum: number | null;       // when every byte was last compared
  held: { deletes: number; limit: number } | null;  // waiting for mirrorSync with approve
  nextScheduled: number;
  everyHours: number;                // 8
  health: { ok: boolean; reason: string | null };   // not ok when held, failed, or nothing synced for over 17 hours
  source: string;
  dest: string;
}
```

TMirrorRun:

```ts
{
  trigger: "scheduled" | "manual" | "checksum";
  startedAt: number;
  finishedAt: number;
  ok: boolean | null;     // null when cancelled
  cancelled?: boolean;
  checksum: boolean;
  error: string | null;
  held: { deletes: number; limit: number } | null;
  stats: { files: number; regular: number; created: number; deleted: number; transferred: number; totalBytes: number; transferredBytes: number } | null;
}
```

### TSearchHit

```ts
{ path: string; size: number; mtime: number }
```

## Errors and limits

| Limit | Value |
|---|---|
| Wrong passwords | 5 per address in 15 minutes, and 20 across all addresses in an hour |
| Sealed request body | 64 KB |
| `read` length | 2 MiB |
| Sessions | 64 at once, the least recently used is dropped |
| Session idle expiry | 30 minutes |
| Vault idle timeout | 5 to 240 minutes, in 5-minute steps, 30 at each unlock |

Errors your client can act on:
- `"Locked"`: the session isn't logged in, or the vault locked. Show the unlock screen.
- `"Wrong password"`
- `"Too many wrong passwords, try again later"`
- `"Not found"`
- `"Bad path"`
- `"There is no vault yet"`: offer `create`.

Anything unexpected returns `"Something went wrong"`. File names and paths are never logged on the server.

## Implementing a client in Swift

Everything needed is in CryptoKit except AES-CTR, which comes from CommonCrypto.

```swift
import CryptoKit
import CommonCrypto

// Session keys
let mine = Curve25519.KeyAgreement.PrivateKey()
let serverKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: serverPub)
let shared = try mine.sharedSecretFromKeyAgreement(with: serverKey)
let salt = Data(SHA256.hash(data: mine.publicKey.rawRepresentation + serverPub))
let material = shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: salt,
    sharedInfo: Data("vault v1 session".utf8), outputByteCount: 64)
let bytes = material.withUnsafeBytes { Data($0) }
let encKey = bytes.prefix(32), macKey = SymmetricKey(data: bytes.suffix(32))

// AES-256-CTR, the same call encrypts and decrypts
func ctr(_ key: Data, _ counter: Data, _ input: Data) -> Data {
    var cryptor: CCCryptorRef?
    key.withUnsafeBytes { k in counter.withUnsafeBytes { iv in
        _ = CCCryptorCreateWithMode(CCOperation(kCCEncrypt), CCMode(kCCModeCTR), CCAlgorithm(kCCAlgorithmAES),
            CCPadding(ccNoPadding), iv.baseAddress, k.baseAddress, key.count, nil, 0, 0,
            CCModeOptions(kCCModeOptionCTR_BE), &cryptor)
    }}
    defer { CCCryptorRelease(cryptor) }
    var output = Data(count: input.count)
    var moved = 0
    output.withUnsafeMutableBytes { out in input.withUnsafeBytes { inp in
        _ = CCCryptorUpdate(cryptor, inp.baseAddress, input.count, out.baseAddress, input.count, &moved)
    }}
    return output
}

func seal(_ label: String, _ plain: Data) -> Data {
    let counter = Data((0..<12).map { _ in UInt8.random(in: 0...255) }) + Data(count: 4)
    let body = ctr(encKey, counter, plain)
    let tag = Data(HMAC<SHA256>.authenticationCode(for: Data(label.utf8) + counter + body, using: macKey))
    return counter + body + tag
}

func open(_ label: String, _ sealed: Data) -> Data? {
    guard sealed.count >= 48 else { return nil }
    let counter = sealed.prefix(16), tag = sealed.suffix(32)
    let body = sealed.dropFirst(16).dropLast(32)
    guard HMAC<SHA256>.isValidAuthenticationCode(tag, authenticating: Data(label.utf8) + counter + body,
        using: macKey) else { return nil }
    return ctr(encKey, Data(counter), Data(body))
}
```

Suggested flow:
1. Pin the key from `GET /api/key` in the Keychain.
2. Open a session.
3. Call `status`. If `exists` is false, offer `create`. If `authed` is false, show the unlock form and call `unlock`.
4. Poll `status` every 2 to 5 seconds while the window is open, and `inbox` or `events` while those views are visible.
5. Browse with `list`. Stream files with `read` into a temporary file or a `Data` buffer, and wipe it when the preview closes.
6. On `"Locked"`, or HTTP 401 (after opening a new session), go back to the unlock form.

The vault locks once it has gone unused for `idleMinutes`. Browsing and reading count as use, polling `status` does not. To count down, add `lockIn` to the time each `status` reply arrives, rather than comparing clocks with the server.
