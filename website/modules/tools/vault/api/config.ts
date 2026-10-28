import path from "node:path";
import { fileURLToPath } from "node:url";

const env = process.env;
const here = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(env.VAULT_PORT) || 7900;
export const HOST = env.VAULT_HOST || "0.0.0.0";
export const DIST = path.join(here, "../dist");
export const EXTPASS = path.join(here, "../bin/extpass.sh");

// The gocryptfs folder, only ciphertext lives here
export const CIPHER = env.VAULT_CIPHER || "/media/Seagate/Vault/cipher";
// Inbox files sealed with the age public key while the vault is locked
export const PENDING = env.VAULT_PENDING || "/media/Seagate/Vault/pending";
// The Samba share FolderSync uploads to
export const INBOX = env.VAULT_INBOX || "/media/Seagate/Inbox";
// Copied into the vault once, never changed or deleted
export const SEED = env.VAULT_SEED || "/media/Seagate/Android";
export const MOUNT = env.VAULT_MOUNT || "/srv/vault";
export const STATE = env.VAULT_STATE || "/var/lib/vault";

// The mirror's paths are literals in api/mirror.ts on purpose, this only switches it off for test instances
export const MIRROR_ENABLED = env.VAULT_MIRROR !== "0";
// Only the dashboard's agent uses it, with the token in the state folder
export const CONTROL_PORT = Number(env.VAULT_CONTROL_PORT) || 7901;

// Inside the mounted vault
export const FILES = path.join(MOUNT, "files");
export const META = path.join(MOUNT, ".vault");
export const AGE_KEY = path.join(META, "age.key");
export const INDEX_FILE = path.join(META, "index.json");
export const SEED_FILE = path.join(META, "seed.json");
// Inbox and seed files land here, under their path relative to the inbox
export const IMPORT_ROOT = "Android";

export const AGE_PUB = path.join(STATE, "age.pub");
export const SERVER_KEY = path.join(STATE, "server-key.json");
export const TMP = path.join(STATE, "tmp");

// Off only for tests as another user, the Samba share needs it
export const ALLOW_OTHER = env.VAULT_ALLOW_OTHER !== "0";
// Each unlock starts at IDLE_MINUTES, it can be moved in steps until the next lock
export const IDLE_MINUTES = Number(env.VAULT_IDLE_MINUTES) || 30;
// How often the inbox and pending folders are checked
export const TICK_MS = (Number(env.VAULT_TICK_SECONDS) || 10) * 1000;
// A file must sit unchanged this long before it counts as fully uploaded
export const SETTLE_MS = (Number(env.VAULT_SETTLE_SECONDS) || 30) * 1000;

// Only the LAN and VPN may talk to it, ufw does the same at the edge
export const ALLOWED = ["192.168.1.0/24", "10.8.0.0/24", "172.18.0.0/16", "127.0.0.0/8"];
