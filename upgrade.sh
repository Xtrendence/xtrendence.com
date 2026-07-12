#!/usr/bin/env bash
#
# upgrade.sh — all-in-one Node upgrade for this Raspberry Pi setup.
#
# What it does, in order:
#   1. Installs the target Node major via nvm, carrying over all global npm
#      packages (pm2, bun, pnpm, corepack, nodemon, tsx, ...).
#   2. Points a stable symlink (~/.local/bin/node-current) at the new Node and
#      rewrites crontab so the hardcoded nvm-versioned node paths follow it.
#      (After this first run, future upgrades never need to touch crontab.)
#   3. Runs install.sh to reinstall + rebuild every module against the new Node
#      (this is what recompiles the native modules: better-sqlite3, bcrypt, sharp).
#   4. Migrates PM2 to the new Node: snapshots the current process list, kills
#      the old (old-Node) daemon, resurrects everything under the new daemon,
#      then re-runs website/start.sh for a clean rebuild+restart of the web apps.
#
# Safe to re-run. Nothing is uninstalled — the old Node stays available.
#
# Usage:
#   ./upgrade.sh            # upgrade to the default target major (22), with prompt
#   ./upgrade.sh 22 --yes   # non-interactive
#   TARGET_MAJOR=20 ./upgrade.sh   # override target via env

set -eo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
TARGET_MAJOR="${1:-${TARGET_MAJOR:-22}}"
# strip a leading "v" if someone passes v22
TARGET_MAJOR="${TARGET_MAJOR#v}"
ASSUME_YES="no"
for arg in "$@"; do
	case "$arg" in
		-y|--yes) ASSUME_YES="yes" ;;
	esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
STABLE_NODE="$HOME/.local/bin/node-current"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
	C_BLUE="\033[1;34m"; C_GREEN="\033[1;32m"; C_YELLOW="\033[1;33m"; C_RED="\033[1;31m"; C_OFF="\033[0m"
else
	C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_OFF=""
fi
step() { echo -e "\n${C_BLUE}==> $*${C_OFF}"; }
ok()   { echo -e "${C_GREEN}  ✓ $*${C_OFF}"; }
warn() { echo -e "${C_YELLOW}  ! $*${C_OFF}"; }
die()  { echo -e "${C_RED}  ✗ $*${C_OFF}" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
step "Preflight"
[ -s "$NVM_DIR/nvm.sh" ] || die "nvm not found at $NVM_DIR/nvm.sh"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

CURRENT_NODE="$(nvm current 2>/dev/null || echo none)"
ok "nvm loaded (current Node: $CURRENT_NODE, target: v$TARGET_MAJOR.x)"
ok "repo: $SCRIPT_DIR"

if [ "$ASSUME_YES" != "yes" ]; then
	echo
	echo    "This will:"
	echo    "  • install Node $TARGET_MAJOR via nvm and make it the default"
	echo    "  • repoint crontab node paths at $STABLE_NODE"
	echo    "  • run install.sh (reinstalls + rebuilds all modules)"
	echo    "  • restart all PM2 apps under Node $TARGET_MAJOR"
	echo
	read -r -p "Continue? [y/N] " reply
	case "$reply" in y|Y|yes|YES) ;; *) die "Aborted." ;; esac
fi

# ---------------------------------------------------------------------------
# 1. Snapshot PM2 (before we touch anything) so we can restore ALL apps —
#    including the osint* apps that start.sh does not manage.
# ---------------------------------------------------------------------------
HAVE_PM2="no"
if command -v pm2 >/dev/null 2>&1; then
	HAVE_PM2="yes"
	step "Snapshotting current PM2 process list"
	pm2 save --force >/dev/null 2>&1 && ok "saved ~/.pm2/dump.pm2" || warn "pm2 save failed (continuing)"
else
	warn "pm2 not on PATH yet — will rely on start.sh to bring up web apps"
fi

# ---------------------------------------------------------------------------
# 2. Install target Node, carrying global packages across from the old version
# ---------------------------------------------------------------------------
step "Installing Node $TARGET_MAJOR via nvm"
if [ "$CURRENT_NODE" != "none" ] && [ "$CURRENT_NODE" != "system" ]; then
	nvm install "$TARGET_MAJOR" --reinstall-packages-from="$CURRENT_NODE" --latest-npm
else
	nvm install "$TARGET_MAJOR" --latest-npm
fi
nvm alias default "$TARGET_MAJOR" >/dev/null
nvm use "$TARGET_MAJOR" >/dev/null

NEW_NODE_BIN="$(nvm which "$TARGET_MAJOR")"
[ -x "$NEW_NODE_BIN" ] || die "could not resolve new node binary via 'nvm which'"
ok "active Node: $(node -v)  ($NEW_NODE_BIN)"
ok "npm: $(npm -v)"

# Verify the toolchain the build scripts need actually came across
step "Verifying global toolchain on Node $TARGET_MAJOR"
for tool in pm2 bun pnpm; do
	if command -v "$tool" >/dev/null 2>&1; then
		ok "$tool -> $(command -v "$tool")"
	else
		warn "$tool missing after reinstall — installing globally"
		npm install -g "$tool" >/dev/null 2>&1 && ok "installed $tool" || warn "failed to install $tool (install.sh may fail)"
	fi
done

# ---------------------------------------------------------------------------
# 3. Stable symlink + crontab rewrite
# ---------------------------------------------------------------------------
step "Repointing stable node symlink and crontab"
mkdir -p "$(dirname "$STABLE_NODE")"
ln -sfn "$NEW_NODE_BIN" "$STABLE_NODE"
ok "$STABLE_NODE -> $NEW_NODE_BIN"

if crontab -l >/dev/null 2>&1; then
	BACKUP="$HOME/crontab.backup.$(date +%Y%m%d-%H%M%S)"
	crontab -l > "$BACKUP"
	ok "backed up crontab to $BACKUP"
	# Replace any nvm-versioned node path (…/.nvm/versions/node/vX.Y.Z/bin/node)
	# with the stable symlink. Idempotent: the symlink path won't re-match.
	crontab -l \
		| sed -E "s#[^[:space:]]*/\.nvm/versions/node/v[0-9]+\.[0-9]+\.[0-9]+/bin/node#$STABLE_NODE#g" \
		| crontab -
	ok "crontab node paths now point at $STABLE_NODE"
else
	warn "no crontab found for $USER — skipping"
fi

# ---------------------------------------------------------------------------
# 4. Reinstall + rebuild all modules against the new Node (native rebuilds here)
# ---------------------------------------------------------------------------
step "Running install.sh (reinstall + rebuild all modules)"
[ -f "$SCRIPT_DIR/install.sh" ] || die "install.sh not found in $SCRIPT_DIR"
bash "$SCRIPT_DIR/install.sh"
ok "install.sh completed"

# ---------------------------------------------------------------------------
# 5. Migrate PM2 to the new Node daemon
# ---------------------------------------------------------------------------
if [ "$HAVE_PM2" = "yes" ] || command -v pm2 >/dev/null 2>&1; then
	step "Migrating PM2 onto Node $TARGET_MAJOR"
	# Kill the old-Node daemon; the next pm2 call spawns a fresh one on the new Node.
	pm2 kill >/dev/null 2>&1 || true
	# Restore the full snapshot (includes osint* apps that start.sh won't touch).
	if [ -f "$HOME/.pm2/dump.pm2" ]; then
		pm2 resurrect >/dev/null 2>&1 && ok "resurrected saved apps under $(node -v)" || warn "pm2 resurrect failed (start.sh will still bring up web apps)"
	fi
	# Clean rebuild + restart of the 7 web apps, then a fresh save.
	if [ -f "$SCRIPT_DIR/website/start.sh" ]; then
		bash "$SCRIPT_DIR/website/start.sh"
		ok "website/start.sh completed"
	else
		warn "website/start.sh not found — web apps not restarted"
	fi
	echo
	pm2 list || true
else
	warn "pm2 unavailable — skipped PM2 migration"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
step "Upgrade complete"
ok "Node is now $(node -v), npm $(npm -v)"
echo
echo -e "${C_YELLOW}Manual follow-ups (only if needed):${C_OFF}"
echo    "  • If PM2 is set to start on boot via systemd, regenerate the unit so it"
echo    "    uses the new Node (needs sudo):"
echo    "        pm2 unstartup && pm2 startup   # run the printed sudo command, then: pm2 save"
echo    "  • The previous Node ($CURRENT_NODE) is still installed. Remove it once"
echo    "    everything looks healthy with:  nvm uninstall $CURRENT_NODE"
echo    "  • Re-enable the dns-updater / url-checker cron lines only if you want them."
