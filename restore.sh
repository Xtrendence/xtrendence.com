#!/usr/bin/env bash
#
# Rebuilds this server from a backup made by the /server dashboard.
#
# On a fresh machine: put the backup ZIP in ~/Documents and run
#   unzip documents-*.zip restore.sh && ./restore.sh
# It finds the ZIP next to it and extracts what it needs. Or point it at one:
#   ./restore.sh path/to/backup.zip
#
# By default it then serves a page on port 3110 that walks through the
# restore, open it on this machine or any other on the network with the link
# it prints. --cli runs the same restore in the terminal instead.
#
# Every step checks whether it is already done, does it if not, then checks
# again. When something needs a person, like a tool it cannot install, a drive
# to plug in or a login, it stops, says exactly what to type, and waits.
# Progress is saved, so running it again carries on where it stopped.
#
#   ./restore.sh              run in the browser, or continue a previous run
#   ./restore.sh --cli        run in the terminal
#   ./restore.sh --check      only report what is done and what is missing
#   ./restore.sh --reset      forget saved progress and start over
#   ./restore.sh --yes        take the default answer to every question and
#                             skip, rather than wait on, anything needing you
#
# It is safe to run on a machine that is already set up: finished steps are
# left alone, files newer than the backup are kept, volumes that hold data are
# never overwritten, and anything it replaces is kept as .before-restore.
#
# Nothing machine specific lives in this file. Repos, drives, containers and
# paths all come from bak/system/manifest.json inside the backup.

set -u

SUPPORTED_MANIFEST=1
# Not always set, for example under docker exec, cron or some sudo setups
export USER="${USER:-$(id -un)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRESS_FILE="$HOME/.restore-progress"
DOCUMENTS="$HOME/Documents"
MODE="run"
SOURCE=""
UNATTENDED=""
# web serves the page, cli asks in the terminal, child is the copy the page
# runs, which reports through @@ lines and reads answers from a pipe
UI="web"
PORT="${RESTORE_PORT:-3110}"
# Step ids to leave out, space separated, for testing
SKIP_STEPS=" ${RESTORE_SKIP:-} "
ORIGINAL_ARGS=("$@")

for arg in "$@"; do
	case "$arg" in
		--check) MODE="check"; [ "$UI" = "child" ] || UI="cli" ;;
		--cli) UI="cli" ;;
		--child) UI="child" ;;
		--reset) rm -f "$PROGRESS_FILE"; echo "Saved progress cleared." ;;
		--yes) UNATTENDED="yes"; UI="cli" ;;
		-h|--help) sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) SOURCE="$arg" ;;
	esac
done

if [ -t 1 ]; then
	BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
else
	BOLD=""; DIM=""; GREEN=""; RED=""; YELLOW=""; RESET=""
fi

ok() { echo "  ${GREEN}✓${RESET} $*"; }
bad() { echo "  ${RED}✗${RESET} $*"; }
warn() { echo "  ${YELLOW}!${RESET} $*"; }
info() { echo "  ${DIM}$*${RESET}"; }
heading() { echo; echo "${BOLD}$*${RESET}"; }

# Structured events for the page. Plain output still goes to the log beside it
emit() { [ "$UI" = "child" ] && printf '@@%s %s\n' "$1" "$2"; return 0; }

# Builds a JSON object from key value pairs
json() { python3 -c 'import json,sys; a=sys.argv[1:]; print(json.dumps(dict(zip(a[::2], a[1::2]))))' "$@"; }

# The page writes each answer into this pipe, one line per question
ui_read() { local line=""; IFS= read -r line <"$RESTORE_FIFO"; printf '%s' "$line"; }

trap 'echo; echo "  Stopped. Progress is saved, run ./restore.sh again to continue."; exit 130' INT

# Preflight. These stop the script outright, since nothing after them works

# Run as root, $HOME is /root and everything would land in the wrong place
if [ "$(id -u)" -eq 0 ]; then
	echo "Run this as your normal user, not with sudo. It asks for sudo itself when it needs it."
	exit 1
fi

# Prompts read from the terminal, so piping the script in needs one attached
if [ "$UI" = "cli" ] && [ ! -r /dev/tty ] && [ "$MODE" = "run" ] && [ -z "$UNATTENDED" ]; then
	echo "This needs a terminal to ask questions. Run it directly: ./restore.sh"
	exit 1
fi

ask() {
	local prompt="$1" default="${2:-y}" answer hint="[Y/n]"
	[ "$default" = "n" ] && hint="[y/N]"
	if [ -n "$UNATTENDED" ]; then
		echo "  $prompt $hint $default"
		[ "$default" = "y" ]
		return
	fi
	if [ "$UI" = "child" ]; then
		emit ASK "$(json prompt "$prompt" default "$default")"
		answer="$(ui_read)"
		echo "  $prompt $hint ${answer:-$default}"
	else
		read -r -p "  $prompt $hint " answer </dev/tty
	fi
	answer="${answer:-$default}"
	[[ "$answer" =~ ^[Yy] ]]
}

# Package manager of this machine, so install commands fit it
PKG=""
if command -v apt-get >/dev/null; then PKG="apt"
elif command -v dnf >/dev/null; then PKG="dnf"
elif command -v pacman >/dev/null; then PKG="pacman"
fi

pkg_install_cmd() {
	case "$PKG" in
		apt) echo "sudo apt-get update && sudo apt-get install -y $*" ;;
		dnf) echo "sudo dnf install -y $*" ;;
		pacman) echo "sudo pacman -S --needed --noconfirm $*" ;;
		*) echo "Install with your package manager: $*" ;;
	esac
}

pkg_install() {
	local command
	command="$(pkg_install_cmd "$@")"
	[ -z "$PKG" ] && { echo "  $command"; return 1; }
	# apt is often busy with automatic updates on a fresh machine
	local tries=0
	while [ "$PKG" = "apt" ] && sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && [ $tries -lt 30 ]; do
		[ $tries -eq 0 ] && info "Waiting for another apt process to finish (usually automatic updates)"
		sleep 10
		tries=$((tries + 1))
	done
	eval "$command"
}

REASON=""
FIX=""
SKIPPED=()
NOTES=()

note() { NOTES+=("$*"); }

wait_for_fix() {
	local title="$1" answer
	echo
	echo "  ${YELLOW}${BOLD}Needs you: ${title}${RESET}"
	echo "  ${REASON}"
	if [ -n "$FIX" ]; then
		echo
		echo "  To fix it:"
		while IFS= read -r line; do echo "    $line"; done <<<"$FIX"
	fi
	echo
	[ -n "$UNATTENDED" ] && return 1
	if [ "$UI" = "child" ]; then
		emit FIX "$(json title "$title" reason "$REASON" fix "$FIX")"
		case "$(ui_read)" in
			retry) return 0 ;;
			quit)
				echo "  Stopped. Progress is saved, run ./restore.sh again to continue from here."
				emit STOPPED "{}"
				exit 0 ;;
			*) return 1 ;;
		esac
	fi
	while true; do
		read -r -p "  Enter to check again once fixed, s to skip this step, q to stop for now: " answer </dev/tty
		case "$answer" in
			"") return 0 ;;
			s|S) return 1 ;;
			q|Q)
				echo
				echo "  Stopped. Progress is saved, run ./restore.sh again to continue from here."
				exit 0 ;;
		esac
	done
}

done_before() { [ -f "$PROGRESS_FILE" ] && grep -qx "$1" "$PROGRESS_FILE"; }
mark_done() { done_before "$1" || echo "$1" >>"$PROGRESS_FILE"; }

# One step: skip if done, check, act, then keep checking until it passes or
# the person skips it
step() {
	local id="$1" title="$2" check="$3" action="$4"
	REASON=""
	FIX=""

	if [[ "$SKIP_STEPS" == *" $id "* ]]; then
		info "$title left out (RESTORE_SKIP)"
		emit STEP "$(json id "$id" state left)"
		return
	fi

	emit STEP "$(json id "$id" state checking)"

	if [ "$MODE" = "check" ]; then
		if "$check"; then
			ok "$title"
			emit STEP "$(json id "$id" state ok)"
		else
			bad "$title: $REASON"
			emit STEP "$(json id "$id" state bad reason "$REASON")"
		fi
		return
	fi

	if "$check"; then
		if done_before "$id"; then ok "$title ${DIM}(done before)${RESET}"; else ok "$title"; fi
		mark_done "$id"
		emit STEP "$(json id "$id" state ok)"
		return
	fi

	echo "  ${BOLD}→${RESET} $title"
	emit STEP "$(json id "$id" state running)"
	"$action"

	while ! "$check"; do
		emit STEP "$(json id "$id" state waiting reason "$REASON")"
		if ! wait_for_fix "$title"; then
			bad "$title skipped"
			SKIPPED+=("$title")
			emit STEP "$(json id "$id" state skipped reason "$REASON")"
			return
		fi
		emit STEP "$(json id "$id" state running)"
		"$action"
	done

	ok "$title"
	mark_done "$id"
	emit STEP "$(json id "$id" state ok)"
}

# Finding the backup

pick_zip() {
	local zips=()
	mapfile -t zips < <(ls -1t "$SCRIPT_DIR"/documents-*.zip 2>/dev/null)
	[ ${#zips[@]} -eq 0 ] && return 1
	if [ ${#zips[@]} -eq 1 ] || [ "$MODE" = "check" ] || [ -n "$UNATTENDED" ]; then
		ZIP="${zips[0]}"
		return 0
	fi
	echo "Several backups are here. Which one?"
	local i
	for i in "${!zips[@]}"; do echo "  $((i + 1))) $(basename "${zips[$i]}")$([ "$i" -eq 0 ] && echo "  (newest)")"; done
	read -r -p "Number [1]: " i </dev/tty
	i="${i:-1}"
	ZIP="${zips[$((i - 1))]:-${zips[0]}}"
}

find_backup() {
	ZIP=""
	if [ -n "$SOURCE" ]; then
		if [ -d "$SOURCE/bak" ]; then BAK="$(cd "$SOURCE/bak" && pwd)"; return; fi
		if [ -d "$SOURCE" ] && [ -f "$SOURCE/system/manifest.json" ]; then BAK="$(cd "$SOURCE" && pwd)"; return; fi
		if [ -f "$SOURCE" ] && [[ "$SOURCE" == *.zip ]]; then
			ZIP="$(realpath "$SOURCE")"
		else
			echo "$SOURCE is neither a backup ZIP nor a folder with bak/ in it."
			exit 1
		fi
	elif [ -f "$SCRIPT_DIR/bak/system/manifest.json" ]; then
		BAK="$SCRIPT_DIR/bak"
		return
	elif ! pick_zip; then
		echo "No backup found."
		echo "Put the backup ZIP next to this script (in $SCRIPT_DIR), or run: ./restore.sh path/to/backup.zip"
		exit 1
	fi

	if ! command -v unzip >/dev/null; then
		echo "unzip is needed to open the backup."
		if [ "$MODE" = "run" ] && ask "Install it now?"; then pkg_install unzip; fi
		command -v unzip >/dev/null || { echo "Install it with: $(pkg_install_cmd unzip)"; exit 1; }
	fi

	local into
	into="$(dirname "$ZIP")"
	echo "Checking $(basename "$ZIP")"
	if ! unzip -tqq "$ZIP" >/dev/null 2>&1; then
		echo "The ZIP is damaged or incomplete. If it was copied, copy it again. If there is an older backup, try that one."
		exit 1
	fi
	echo "Extracting bak/ into $into"
	unzip -q -o "$ZIP" 'bak/*' -d "$into" || { echo "Extracting failed, the disk may be full: df -h $into"; exit 1; }
	BAK="$into/bak"
}

find_backup
MANIFEST="$BAK/system/manifest.json"

if ! command -v python3 >/dev/null; then
	echo "python3 is needed to read the backup's manifest."
	if [ "$MODE" = "run" ] && ask "Install it now?"; then pkg_install python3; fi
	command -v python3 >/dev/null || { echo "Install it with: $(pkg_install_cmd python3)"; exit 1; }
fi

if [ ! -f "$MANIFEST" ]; then
	echo "$MANIFEST is missing. This backup is from before restore support was added, so only its files can be used:"
	echo "  rsync -a \"$BAK/documents/\" \"$DOCUMENTS/\""
	exit 1
fi

mf() {
	python3 - "$MANIFEST" "$@" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
exec(sys.argv[2])
PY
}

if [ "$(mf 'print(m.get("version", 1))')" -gt "$SUPPORTED_MANIFEST" ]; then
	warn "This backup is newer than this script. Use the restore.sh from inside the backup ZIP instead."
fi

# The browser page. The script stays the source of truth: the page runs it
# as a child and shows what it prints, and answers go back through a pipe.
# Kept in this file so the backup only ever needs the one script
start_web_ui() {
	local work
	work="$(mktemp -d)"
	chmod 700 "$work"

	cat >"$work/server.py" <<'RESTORE_SERVER_PY'
import hmac
import http.server
import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, urlparse

# The page restore.sh serves. Runs the script as a child, turns its output
# into events, and passes answers back through a pipe. Standard library only,
# since a fresh machine may have nothing else yet

PORT = int(sys.argv[1])
TOKEN = sys.argv[2]
SCRIPT = sys.argv[3]
BAK = sys.argv[4]
PAGE = sys.argv[5]
WORK = os.path.dirname(PAGE)
FIFO = os.path.join(WORK, "answers")
PROGRESS = os.path.expanduser("~/.restore-progress")
MAX_EVENTS = 20000

os.mkfifo(FIFO, 0o600)

with open(os.path.join(BAK, "system", "manifest.json")) as f:
    MANIFEST = json.load(f)

state = {
    "events": [],
    "first": 0,
    "prompt": None,
    "running": False,
    "mode": None,
    "exit": None,
}
lock = threading.Condition()
child = None


def add(event):
    with lock:
        event["seq"] = state["first"] + len(state["events"])
        event["at"] = time.time()
        state["events"].append(event)
        # Long runs print a lot, so only the newest events are kept
        if len(state["events"]) > MAX_EVENTS:
            drop = len(state["events"]) - MAX_EVENTS
            state["events"] = state["events"][drop:]
            state["first"] += drop
        lock.notify_all()


def handle_line(line):
    if line.startswith("@@"):
        kind, _, payload = line[2:].partition(" ")
        try:
            data = json.loads(payload) if payload else {}
        except ValueError:
            data = {"raw": payload}
        event = {"type": kind.lower(), "data": data}
        if kind in ("ASK", "FIX", "CHOOSE"):
            with lock:
                state["prompt"] = event
        add(event)
    else:
        add({"type": "log", "text": line})


def read_output(process):
    buffer = b""
    while True:
        chunk = process.stdout.read1(4096) if hasattr(process.stdout, "read1") else process.stdout.read(4096)
        if not chunk:
            break
        buffer += chunk
        while b"\n" in buffer:
            raw, buffer = buffer.split(b"\n", 1)
            # Progress bars redraw with carriage returns, keep what was last drawn
            text = raw.decode("utf-8", "replace").split("\r")[-1].rstrip()
            handle_line(text)
    if buffer:
        handle_line(buffer.decode("utf-8", "replace").split("\r")[-1])
    code = process.wait()
    with lock:
        state["running"] = False
        state["prompt"] = None
        state["exit"] = code
    add({"type": "exit", "data": {"code": code}})


def start(mode):
    global child
    with lock:
        if state["running"]:
            return False, "A run is already going"
        state["running"] = True
        state["mode"] = mode
        state["exit"] = None
        state["prompt"] = None
    add({"type": "start", "data": {"mode": mode}})
    args = ["bash", SCRIPT, "--child", BAK]
    if mode == "check":
        args.append("--check")
    env = dict(os.environ, RESTORE_FIFO=FIFO, RESTORE_UI="child")
    # Its own process group, so stopping it also stops whatever it is running
    child = subprocess.Popen(
        args,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        start_new_session=True,
    )
    threading.Thread(target=read_output, args=(child,), daemon=True).start()
    return True, None


def answer(value):
    with lock:
        prompt = state["prompt"]
        if not prompt:
            return False, "Nothing is waiting for an answer"
        state["prompt"] = None
    add({"type": "answered", "data": {"value": value, "to": prompt["type"]}})

    # Opening the pipe waits for the script to be reading, so it runs apart
    def write():
        with open(FIFO, "w") as pipe:
            pipe.write(value + "\n")

    threading.Thread(target=write, daemon=True).start()
    return True, None


def stop():
    with lock:
        prompt = state["prompt"]
        running = state["running"]
    if not running:
        return
    # At a fix prompt the script can stop itself cleanly
    if prompt and prompt["type"] == "fix":
        answer("quit")
        return
    try:
        os.killpg(child.pid, signal.SIGINT)
    except (ProcessLookupError, AttributeError):
        pass


def info():
    m = MANIFEST
    return {
        "hostname": m.get("hostname"),
        "createdAt": m.get("createdAt"),
        "os": m.get("os"),
        "oldHome": "/home/" + str(m.get("user")),
        "home": os.path.expanduser("~"),
        "repos": len(m.get("repos", [])),
        "apps": len(m.get("pm2", {}).get("apps", [])),
        "containers": sum(len(c.get("containers", [])) for c in m.get("docker", {}).get("compose", [])) + len(m.get("docker", {}).get("standalone", [])),
        "drives": len(m.get("fstab", {}).get("extra", [])),
        "leftOut": [{"name": s.get("name"), "reason": s.get("reason")} for s in m.get("docker", {}).get("skipped", [])],
        "hasProgress": os.path.exists(PROGRESS),
        "machine": socket.gethostname(),
    }


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def authorised(self):
        query = parse_qs(urlparse(self.path).query)
        given = self.headers.get("X-Restore-Token") or (query.get("t") or [""])[0]
        return hmac.compare_digest(given, TOKEN)

    def send(self, code, body, kind="application/json"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)

    def json(self, code, value):
        self.send(code, json.dumps(value))

    def body(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        path = urlparse(self.path).path
        if not self.authorised():
            if path == "/":
                self.send(403, "<!doctype html><meta charset=utf-8><title>Restore</title><body style='font:16px system-ui;background:#05070f;color:#eef1f8;padding:40px'>Open the link printed in the terminal, it includes the access code.", "text/html; charset=utf-8")
            else:
                self.json(403, {"error": "Missing or wrong access code"})
            return

        if path == "/":
            with open(PAGE, "rb") as f:
                self.send(200, f.read(), "text/html; charset=utf-8")
        elif path == "/api/info":
            self.json(200, info())
        elif path == "/api/events":
            since = int((parse_qs(urlparse(self.path).query).get("since") or ["0"])[0])
            # Long poll: answers as soon as there is something new, or after a while anyway
            # A page's first request answers straight away, so it can show its state
            deadline = time.time() + (0 if since == 0 else 25)
            with lock:
                while state["first"] + len(state["events"]) <= since and time.time() < deadline:
                    lock.wait(timeout=max(0.1, deadline - time.time()))
                start_at = max(0, since - state["first"])
                events = state["events"][start_at:start_at + 2000]
                snapshot = {
                    "events": events,
                    "first": state["first"],
                    "next": state["first"] + start_at + len(events),
                    "prompt": state["prompt"],
                    "running": state["running"],
                    "mode": state["mode"],
                    "exit": state["exit"],
                }
            self.json(200, snapshot)
        else:
            self.json(404, {"error": "Not found"})

    def do_POST(self):
        if not self.authorised():
            self.json(403, {"error": "Missing or wrong access code"})
            return
        path = urlparse(self.path).path
        payload = self.body()
        if path == "/api/start":
            ok, error = start("check" if payload.get("mode") == "check" else "run")
            self.json(200 if ok else 409, {"ok": ok, "error": error})
        elif path == "/api/answer":
            ok, error = answer(str(payload.get("value", "")))
            self.json(200 if ok else 409, {"ok": ok, "error": error})
        elif path == "/api/stop":
            stop()
            self.json(200, {"ok": True})
        elif path == "/api/reset":
            with lock:
                running = state["running"]
            if running:
                self.json(409, {"ok": False, "error": "Stop the run first"})
                return
            # Only the saved progress file, which records which steps finished
            try:
                os.remove(PROGRESS)
            except FileNotFoundError:
                pass
            self.json(200, {"ok": True})
        elif path == "/api/shutdown":
            self.json(200, {"ok": True})
            stop()
            threading.Thread(target=lambda: (time.sleep(0.5), os._exit(0)), daemon=True).start()
        else:
            self.json(404, {"error": "Not found"})


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


server = None
for port in range(PORT, PORT + 10):
    try:
        server = Server(("0.0.0.0", port), Handler)
        PORT = port
        break
    except OSError:
        continue
if not server:
    print(f"Ports {PORT} to {PORT + 9} are all taken. Pick another with: RESTORE_PORT=4000 ./restore.sh")
    sys.exit(1)


def addresses():
    found = []
    try:
        output = subprocess.run(["hostname", "-I"], capture_output=True, text=True).stdout
        found = [a for a in output.split() if ":" not in a]
    except OSError:
        pass
    return found


print()
print("  The restore page is ready. Open it here, or from another machine on the network:")
print()
print(f"    http://localhost:{PORT}/?t={TOKEN}")
for address in addresses():
    print(f"    http://{address}:{PORT}/?t={TOKEN}")
print()
print("  The code in the link keeps anyone else on the network out.")
print("  If another machine cannot connect, a firewall may be blocking the port: sudo ufw allow " + str(PORT) + "/tcp")
print("  Press Ctrl+C here to stop the page. Progress is saved either way.")
print()
sys.stdout.flush()


def shutdown(*_):
    stop()
    os._exit(0)


signal.signal(signal.SIGTERM, shutdown)
try:
    server.serve_forever()
except KeyboardInterrupt:
    shutdown()
RESTORE_SERVER_PY

	cat >"$work/page.html" <<'RESTORE_PAGE_HTML'
<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="referrer" content="no-referrer" />
<title>Restore</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
<style>
/* The same glass system as the /server dashboard and the lights app. The
   ambient blobs hold still and only the top level panels blur, which is what
   keeps it smooth, since every blurred layer re-blurs its backdrop each frame */

:root {
	--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	--amber: #feac5e;
	--violet: #c779d0;
	--cyan: #4bc0c8;
	--r-sm: 12px;
	--r-md: 18px;
	--r-lg: 26px;
	--r-pill: 999px;
	--ease: cubic-bezier(0.22, 1, 0.36, 1);
	--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);

	color-scheme: dark;
	--bg-0: #05070f;
	--bg-1: #080c18;
	--ink: #eef1f8;
	--ink-2: rgba(238, 241, 248, 0.68);
	--ink-3: rgba(238, 241, 248, 0.46);
	--glass-bg: rgba(255, 255, 255, 0.045);
	--glass-bg-strong: rgba(255, 255, 255, 0.075);
	--glass-bg-hover: rgba(255, 255, 255, 0.085);
	--glass-border: rgba(255, 255, 255, 0.11);
	--glass-border-hover: rgba(255, 255, 255, 0.2);
	--glass-hi: rgba(255, 255, 255, 0.26);
	--glass-lo: rgba(255, 255, 255, 0.04);
	--glass-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.85);
	--top-light: rgba(255, 255, 255, 0.14);
	--blob-opacity: 0.5;
	--hairline: rgba(255, 255, 255, 0.08);
	--accent-ink: #86dbe2;
	--accent-bg: rgba(75, 192, 200, 0.13);
	--accent-line: rgba(75, 192, 200, 0.3);
	--accent-fill: #4bc0c8;
	--accent-fill-ink: #04161a;
	--accent-glow: rgba(75, 192, 200, 0.45);
	--track: rgba(255, 255, 255, 0.07);
	--ok: #6fd39b;
	--warn: #f2c46a;
	--bad: #f08a8a;
}

@media (prefers-color-scheme: light) {
	:root {
		color-scheme: light;
		--bg-0: #e4e9f4;
		--bg-1: #f4f6fc;
		--ink: #0a0e1c;
		--ink-2: rgba(10, 14, 28, 0.74);
		--ink-3: rgba(10, 14, 28, 0.56);
		--glass-bg: rgba(255, 255, 255, 0.6);
		--glass-bg-strong: rgba(255, 255, 255, 0.78);
		--glass-bg-hover: rgba(255, 255, 255, 0.9);
		--glass-border: rgba(255, 255, 255, 0.85);
		--glass-border-hover: rgba(255, 255, 255, 1);
		--glass-hi: rgba(255, 255, 255, 0.95);
		--glass-lo: rgba(12, 16, 32, 0.03);
		--glass-shadow: 0 22px 50px -24px rgba(24, 34, 74, 0.38);
		--top-light: rgba(255, 255, 255, 0.6);
		--blob-opacity: 0.34;
		--hairline: rgba(10, 14, 28, 0.13);
		--accent-ink: #0c6e77;
		--accent-bg: rgba(75, 192, 200, 0.16);
		--accent-line: rgba(12, 110, 119, 0.28);
		--accent-fill: #0d7681;
		--accent-fill-ink: #ffffff;
		--accent-glow: rgba(13, 118, 129, 0.32);
		--track: rgba(10, 14, 28, 0.09);
		--ok: #1f8a52;
		--warn: #9a6a10;
		--bad: #c0392b;
	}
}

*, *::before, *::after { box-sizing: border-box; }

html { font-family: var(--font-sans); -webkit-text-size-adjust: 100%; }

body {
	margin: 0;
	min-height: 100vh;
	background: var(--bg-0);
	color: var(--ink);
	font-size: 15px;
	line-height: 1.6;
	letter-spacing: -0.011em;
	-webkit-font-smoothing: antialiased;
	overflow-x: hidden;
}

button { font: inherit; color: inherit; border: none; background: none; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
:focus-visible { outline: 2px solid var(--accent-fill); outline-offset: 3px; border-radius: 6px; }
[hidden] { display: none !important; }

.backdrop {
	position: fixed;
	inset: 0;
	z-index: -1;
	overflow: hidden;
	pointer-events: none;
	background: radial-gradient(120% 90% at 50% -10%, var(--bg-1) 0%, var(--bg-0) 62%) var(--bg-0);
}

.blob {
	position: absolute;
	width: 46vmax;
	height: 46vmax;
	opacity: var(--blob-opacity);
	filter: blur(90px);
}

.blob-1 { top: -14vmax; left: -8vmax; background: radial-gradient(circle at 40% 40%, var(--amber), transparent 68%); border-radius: 58% 42% 39% 61% / 47% 52% 48% 53%; }
.blob-2 { top: 6vmax; right: -12vmax; background: radial-gradient(circle at 60% 40%, var(--violet), transparent 68%); border-radius: 40% 60% 63% 37% / 55% 41% 59% 45%; }
.blob-3 { bottom: -18vmax; left: 26%; background: radial-gradient(circle at 50% 50%, var(--cyan), transparent 68%); border-radius: 51% 49% 44% 56% / 43% 57% 43% 57%; }

.glass {
	position: relative;
	border-radius: var(--r-lg);
	background: var(--glass-bg);
	border: 1px solid var(--glass-border);
	-webkit-backdrop-filter: blur(22px) saturate(185%);
	backdrop-filter: blur(22px) saturate(185%);
	box-shadow: var(--glass-shadow), inset 0 1px 0 var(--glass-hi), inset 0 -1px 0 var(--glass-lo);
}

.glass::before {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: inherit;
	pointer-events: none;
	background: linear-gradient(158deg, var(--top-light) 0%, rgba(255, 255, 255, 0) 46%);
}

.glass > * { position: relative; }

.shell {
	width: min(1180px, 100% - 40px);
	margin: 0 auto;
	padding: 96px 0 64px;
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.topbar {
	position: fixed;
	top: 16px;
	left: 50%;
	z-index: 10;
	display: flex;
	align-items: center;
	gap: 12px;
	width: min(1180px, 100% - 40px);
	padding: 10px 12px 10px 20px;
	border-radius: var(--r-pill);
	transform: translateX(-50%);
}

.wordmark { font-size: 17px; font-weight: 700; letter-spacing: -0.03em; margin-right: auto; }
.wordmark span { color: var(--ink-3); font-weight: 500; }

.chip {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	height: 30px;
	padding: 0 12px;
	border-radius: var(--r-pill);
	font-family: var(--font-mono);
	font-size: 11.5px;
	color: var(--ink-2);
	background: var(--glass-lo);
	border: 1px solid var(--hairline);
	white-space: nowrap;
}

.chip .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); }
.chip.live .dot { background: var(--ok); box-shadow: 0 0 8px -1px var(--ok); }
.chip.lost { color: var(--bad); }
.chip.lost .dot { background: var(--bad); }

.panel { padding: 24px 26px; }

.eyebrow {
	font-family: var(--font-mono);
	font-size: 10.5px;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--ink-3);
}

h1 { margin: 6px 0 0; font-size: 32px; line-height: 1.1; letter-spacing: -0.04em; font-weight: 650; }
h2 { margin: 0; font-size: 18px; letter-spacing: -0.02em; font-weight: 600; }
h3 { margin: 0 0 10px; font-size: 13px; letter-spacing: -0.01em; font-weight: 600; color: var(--ink-2); }
p { margin: 0; }

.lede { margin-top: 10px; color: var(--ink-2); max-width: 60ch; }

.tiles {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: 10px;
	margin-top: 22px;
}

.tile {
	padding: 14px 16px;
	border-radius: var(--r-md);
	background: var(--glass-lo);
	border: 1px solid var(--hairline);
}

.tile b { display: block; font-size: 26px; font-weight: 600; letter-spacing: -0.04em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tile span { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }

.facts { margin-top: 18px; display: flex; flex-direction: column; }
.fact { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-top: 1px solid var(--hairline); font-size: 13.5px; }
.fact:first-child { border-top: 0; }
.fact span:first-child { color: var(--ink-3); }
.fact span:last-child { text-align: right; font-family: var(--font-mono); font-size: 12.5px; word-break: break-all; }

.left-out { margin-top: 18px; font-size: 13px; color: var(--ink-3); }
.left-out li { margin: 4px 0; }
.left-out b { color: var(--ink-2); font-weight: 500; font-family: var(--font-mono); font-size: 12px; }

.actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 22px; }
.actions .hint { margin-right: auto; font-size: 12.5px; color: var(--ink-3); }

.btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	height: 40px;
	padding: 0 18px;
	border-radius: var(--r-pill);
	font-size: 13.5px;
	font-weight: 550;
	white-space: nowrap;
	transition: background 0.25s var(--ease), border-color 0.25s var(--ease), color 0.25s var(--ease), transform 0.3s var(--ease-spring);
}

.btn--accent { color: var(--accent-fill-ink); background: var(--accent-fill); }
.btn--accent:not(:disabled):hover { box-shadow: 0 10px 26px -12px var(--accent-glow); transform: translateY(-1px); }
.btn--ghost { color: var(--ink); background: var(--glass-lo); border: 1px solid var(--glass-border); }
.btn--ghost:not(:disabled):hover { background: var(--glass-bg-hover); border-color: var(--glass-border-hover); }
.btn--danger:not(:disabled):hover, .btn--danger.armed { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); background: color-mix(in srgb, var(--bad) 10%, transparent); }
.btn--sm { height: 32px; padding: 0 13px; font-size: 12.5px; }

/* Running */

.run { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
.run-main { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

.steps { position: sticky; top: 90px; max-height: calc(100vh - 110px); overflow-y: auto; }

/* Pinned at the top of the steps panel, which scrolls to follow the step
   that is running, so the overall progress never scrolls away */
.steps > .eyebrow, .progress { position: sticky; z-index: 1; background: color-mix(in srgb, var(--bg-1) 88%, transparent); }
.steps > .eyebrow { top: -24px; display: block; margin: -24px -26px 0; padding: 24px 26px 0; }
.progress { top: -4px; margin: 0 -26px 14px; padding: 10px 26px 14px; border-bottom: 1px solid var(--hairline); }
.progress-top { display: flex; justify-content: space-between; align-items: baseline; }
.progress-top b { font-size: 22px; font-weight: 600; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.progress-top span { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
.bar { height: 6px; margin-top: 8px; border-radius: var(--r-pill); background: var(--track); overflow: hidden; }
.bar div { height: 100%; width: 0; border-radius: inherit; background: var(--accent-fill); transition: width 0.6s var(--ease); }

.step-section { margin-top: 14px; }
.step-section:first-of-type { margin-top: 0; }
.step-section > .eyebrow { display: block; margin-bottom: 6px; }

.step {
	--tone: var(--ink-3);
	display: grid;
	grid-template-columns: 18px 1fr;
	gap: 10px;
	align-items: start;
	padding: 6px 8px;
	margin: 0 -8px;
	border-radius: 10px;
	font-size: 13.5px;
	color: var(--ink-2);
	transition: background 0.3s var(--ease), color 0.3s var(--ease);
}

.step .mark {
	width: 18px;
	height: 18px;
	margin-top: 2px;
	border-radius: 50%;
	border: 1.5px solid var(--tone);
	display: grid;
	place-items: center;
	font-size: 11px;
	font-weight: 700;
	color: var(--tone);
	line-height: 1;
}

.step .why { display: block; font-size: 11.5px; color: var(--ink-3); line-height: 1.4; margin-top: 2px; }
.step.ok { --tone: var(--ok); color: var(--ink); }
.step.ok .mark { background: color-mix(in srgb, var(--ok) 18%, transparent); }
.step.ok .mark::after { content: "✓"; }
.step.checking, .step.running { --tone: var(--accent-fill); color: var(--ink); background: var(--accent-bg); }
.step.checking .mark, .step.running .mark { border-top-color: transparent; animation: spin 0.9s linear infinite; }
.step.waiting { --tone: var(--warn); color: var(--ink); background: color-mix(in srgb, var(--warn) 10%, transparent); }
.step.waiting .mark::after { content: "!"; }
/* Skipped still needs doing, so it stands out. Left out was on purpose */
.step.skipped { --tone: var(--warn); color: var(--ink-2); }
.step.skipped .mark { border-style: dashed; }
.step.skipped .mark::after, .step.left .mark::after { content: "–"; }
.step.left { --tone: var(--ink-3); color: var(--ink-3); }
.step.bad { --tone: var(--bad); color: var(--ink); }
.step.bad .mark::after { content: "×"; }

@keyframes spin { to { transform: rotate(360deg); } }

.prompt { border-color: color-mix(in srgb, var(--accent-fill) 35%, var(--glass-border)); }
.prompt.fix { border-color: color-mix(in srgb, var(--warn) 40%, var(--glass-border)); }
.prompt.fix .eyebrow { color: var(--warn); }
.prompt h2 { margin-top: 6px; }
.prompt .reason { margin-top: 8px; color: var(--ink-2); }

.commands { margin-top: 16px; border-radius: var(--r-sm); background: var(--glass-lo); border: 1px solid var(--hairline); overflow: hidden; }
.commands-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--hairline); }
.command { display: flex; align-items: flex-start; gap: 10px; padding: 6px 8px 6px 14px; }
.command code { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 12.5px; white-space: pre-wrap; word-break: break-word; line-height: 1.7; }
.command.text code { font-family: var(--font-sans); color: var(--ink-3); font-size: 12.5px; }
.copy { flex: none; height: 26px; padding: 0 10px; border-radius: var(--r-pill); font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-3); border: 1px solid var(--hairline); }
.copy:hover { color: var(--ink); border-color: var(--glass-border-hover); }

.options { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.option { text-align: left; padding: 12px 14px; border-radius: var(--r-sm); background: var(--glass-lo); border: 1px solid var(--hairline); font-family: var(--font-mono); font-size: 12.5px; transition: border-color 0.25s var(--ease), background 0.25s var(--ease); }
.option:hover { border-color: var(--accent-line); background: var(--accent-bg); }

.finish.good { border-color: color-mix(in srgb, var(--ok) 35%, var(--glass-border)); }
.finish.good .eyebrow { color: var(--ok); }
.finish ul { margin: 12px 0 0; padding-left: 18px; color: var(--ink-2); font-size: 13.5px; }
.finish li { margin: 6px 0; word-break: break-word; }
.finish .group { margin-top: 18px; }

.console { padding: 0; overflow: hidden; }
.console-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 12px 22px; border-bottom: 1px solid var(--hairline); }
.console-head h2 { font-size: 14px; margin-right: auto; }
.log {
	margin: 0;
	height: 460px;
	overflow: auto;
	padding: 14px 22px 18px;
	font-family: var(--font-mono);
	font-size: 12px;
	line-height: 1.65;
	color: var(--ink-2);
	white-space: pre-wrap;
	word-break: break-word;
	contain: content;
}
.log .l-ok { color: var(--ok); }
.log .l-bad { color: var(--bad); }
.log .l-warn { color: var(--warn); }
.log .l-go { color: var(--accent-ink); }
.log .l-head { color: var(--ink); font-weight: 600; }
.log .l-dim { color: var(--ink-3); }

.toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-3); cursor: pointer; }
.toggle input { accent-color: var(--accent-fill); }

@media (max-width: 860px) {
	.run { grid-template-columns: 1fr; }
	.steps { position: static; max-height: none; }
	.shell, .topbar { width: calc(100% - 24px); }
	.panel { padding: 20px; }
	h1 { font-size: 26px; }
	.log { height: 360px; }
	.topbar .chip.host { display: none; }
}

@media (prefers-reduced-motion: reduce) {
	*, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
</style>
</head>
<body>
<div class="backdrop" aria-hidden="true"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div>

<header class="topbar glass">
	<span class="wordmark">Restore <span id="machine"></span></span>
	<span class="chip host" id="host-chip"></span>
	<span class="chip" id="conn"><span class="dot"></span><span id="conn-text">Connecting</span></span>
</header>

<main class="shell">
	<section class="glass panel intro" id="intro">
		<span class="eyebrow">Backup</span>
		<h1 id="intro-title">Loading the backup</h1>
		<p class="lede">Each step checks whether it is already done, does it if not, and checks again. When something needs you, it stops here and says what to do. Progress is saved, so closing this page or stopping partway is fine.</p>
		<div class="tiles" id="tiles"></div>
		<div class="facts" id="facts"></div>
		<div id="left-out"></div>
		<div class="actions">
			<span class="hint" id="intro-hint"></span>
			<button class="btn btn--ghost btn--sm btn--danger" type="button" id="reset" hidden>Forget saved progress</button>
			<button class="btn btn--ghost" type="button" id="check">Check only</button>
			<button class="btn btn--accent" type="button" id="start">Start restore</button>
		</div>
	</section>

	<div class="run" id="run" hidden>
		<aside class="glass panel steps">
			<span class="eyebrow" id="run-mode">Restoring</span>
			<div class="progress">
				<div class="progress-top"><b id="progress-count">0 / 0</b><span id="progress-state">Starting</span></div>
				<div class="bar"><div id="progress-bar"></div></div>
			</div>
			<div id="steps"></div>
		</aside>

		<div class="run-main">
			<section class="glass panel prompt" id="prompt" hidden></section>
			<section class="glass panel finish" id="finish" hidden></section>
			<section class="glass console">
				<div class="console-head">
					<h2>Output</h2>
					<label class="toggle"><input type="checkbox" id="follow" checked /> Follow</label>
					<button class="btn btn--ghost btn--sm btn--danger" type="button" id="stop">Stop for now</button>
				</div>
				<pre class="log" id="log" aria-live="off"></pre>
			</section>
		</div>
	</div>
</main>

<script>
(() => {
	const params = new URLSearchParams(location.search);
	let token = params.get('t') || '';
	try {
		if (token) sessionStorage.setItem('restore-token', token);
		else token = sessionStorage.getItem('restore-token') || '';
	} catch {}
	// The code stays out of the address bar once read, so it is not left on screen
	if (params.has('t')) history.replaceState(null, '', location.pathname);

	const $ = (id) => document.getElementById(id);
	const MAX_LOG_LINES = 5000;

	const api = async (path, body) => {
		const response = await fetch(path, {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'X-Restore-Token': token, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
		return data;
	};

	const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

	const formatDate = (value) => {
		if (!value) return 'unknown';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	};

	// Intro

	let info = null;

	async function loadInfo() {
		info = await api('/api/info');
		$('machine').textContent = `· ${info.machine}`;
		$('host-chip').textContent = info.home;
		$('intro-title').textContent = `Bring back ${info.hostname}`;
		$('tiles').innerHTML = [
			[info.repos, 'Repos'],
			[info.apps, 'pm2 apps'],
			[info.containers, 'Containers'],
			[info.drives, 'Drives'],
		].map(([n, label]) => `<div class="tile"><b>${n}</b><span>${label}</span></div>`).join('');

		const facts = [
			['Backup made', formatDate(info.createdAt)],
			['From', `${info.hostname}${info.os ? `, ${info.os}` : ''}`],
			['Restoring into', info.home],
		];
		if (info.oldHome !== info.home) facts.push(['Paths moved from', info.oldHome]);
		$('facts').innerHTML = facts.map(([k, v]) => `<div class="fact"><span>${escape(k)}</span><span>${escape(v)}</span></div>`).join('');

		$('left-out').innerHTML = info.leftOut.length
			? `<ul class="left-out">${info.leftOut.map((item) => `<li><b>${escape(item.name)}</b> is not in the backup. ${escape(item.reason)}.</li>`).join('')}</ul>`
			: '';

		$('conn').className = 'chip live';
		$('conn-text').textContent = 'Connected';
		$('reset').hidden = !info.hasProgress;
		$('intro-hint').textContent = info.hasProgress ? 'A previous run was saved, finished steps are not redone.' : '';
	}

	// Steps

	let plan = [];
	const states = new Map();

	function renderPlan() {
		$('steps').innerHTML = plan
			.map(
				(section) => `
					<div class="step-section">
						<span class="eyebrow">${escape(section.section)}</span>
						${section.steps.map((step) => `<div class="step" data-id="${escape(step.id)}"><span class="mark"></span><span>${escape(step.title)}<span class="why"></span></span></div>`).join('')}
					</div>
				`
			)
			.join('');
		for (const [id, state] of states) paintStep(id, state);
		updateProgress();
	}

	function paintStep(id, state) {
		const element = document.querySelector(`.step[data-id="${CSS.escape(id)}"]`);
		if (!element) return;
		element.className = `step ${state.state}`;
		const why = element.querySelector('.why');
		why.textContent = ['waiting', 'skipped', 'bad'].includes(state.state) && state.reason ? state.reason : state.state === 'left' ? 'Left out for this run' : '';
		if (state.state === 'running' || state.state === 'waiting') element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	const FINAL = new Set(['ok', 'skipped', 'left', 'bad']);

	function updateProgress() {
		const all = plan.flatMap((section) => section.steps);
		const done = all.filter((step) => FINAL.has(states.get(step.id)?.state)).length;
		$('progress-count').textContent = `${done} / ${all.length}`;
		$('progress-bar').style.width = all.length ? `${(done / all.length) * 100}%` : '0';
		const current = all.find((step) => ['running', 'checking', 'waiting'].includes(states.get(step.id)?.state));
		if (current) $('progress-state').textContent = states.get(current.id).state === 'waiting' ? `Waiting on ${current.title}` : current.title;
	}

	// Output

	let followLog = true;
	$('follow').addEventListener('change', (event) => { followLog = event.target.checked; });

	function lineClass(text) {
		const t = text.trimStart();
		if (t.startsWith('✓')) return 'l-ok';
		if (t.startsWith('✗')) return 'l-bad';
		if (t.startsWith('!') || t.startsWith('Needs you')) return 'l-warn';
		if (t.startsWith('→')) return 'l-go';
		if (text && !text.startsWith(' ')) return 'l-head';
		return '';
	}

	// Appended as nodes rather than rebuilt, so a long run stays smooth
	const pending = [];
	let flushQueued = false;

	function log(text) {
		pending.push(text);
		if (!flushQueued) {
			flushQueued = true;
			requestAnimationFrame(flushLog);
		}
	}

	function flushLog() {
		flushQueued = false;
		const box = $('log');
		const fragment = document.createDocumentFragment();
		for (const text of pending.splice(0)) {
			const line = document.createElement('div');
			const cls = lineClass(text);
			if (cls) line.className = cls;
			line.textContent = text || ' ';
			fragment.append(line);
		}
		box.append(fragment);
		while (box.childElementCount > MAX_LOG_LINES) box.firstElementChild.remove();
		if (followLog) box.scrollTop = box.scrollHeight;
	}

	// Prompts

	let shownPrompt = null;

	function renderPrompt(prompt) {
		const box = $('prompt');
		const key = prompt ? `${prompt.seq}` : null;
		if (key === shownPrompt) return;
		shownPrompt = key;

		if (!prompt) {
			box.hidden = true;
			box.innerHTML = '';
			return;
		}

		const data = prompt.data || {};
		box.className = `glass panel prompt ${prompt.type}`;
		box.hidden = false;

		if (prompt.type === 'ask') {
			const yesDefault = data.default !== 'n';
			box.innerHTML = `
				<span class="eyebrow">Question</span>
				<h2>${escape(data.prompt)}</h2>
				<div class="actions">
					<button class="btn ${yesDefault ? 'btn--ghost' : 'btn--accent'}" type="button" data-answer="n">No</button>
					<button class="btn ${yesDefault ? 'btn--accent' : 'btn--ghost'}" type="button" data-answer="y">Yes</button>
				</div>`;
		} else if (prompt.type === 'fix') {
			const lines = String(data.fix || '').split('\n').filter((line) => line.trim());
			// Lines that read like commands get a copy button, prose does not
			const isCommand = (line) => /^(sudo |curl |cd |git |npm |nvm |pipx |python3 |rsync |mkdir |ln |crontab |cloudflared |docker |pm2 |sed |chmod |echo |sh |bash |gh |ping |getent |timedatectl |journalctl |du |df |ufw )/.test(line.trim());
			box.innerHTML = `
				<span class="eyebrow">Needs you</span>
				<h2>${escape(data.title)}</h2>
				<p class="reason">${escape(data.reason)}</p>
				${lines.length ? `
					<div class="commands">
						<div class="commands-head"><span class="eyebrow">To fix it</span>${lines.some(isCommand) ? '<button class="copy" type="button" data-copy-all>Copy commands</button>' : ''}</div>
						${lines.map((line) => isCommand(line)
							? `<div class="command"><code>${escape(line)}</code><button class="copy" type="button" data-copy="${escape(line)}">Copy</button></div>`
							: `<div class="command text"><code>${escape(line)}</code></div>`).join('')}
					</div>` : ''}
				<div class="actions">
					<span class="hint">Fix it in a terminal on the server, then check again.</span>
					<button class="btn btn--ghost btn--danger" type="button" data-answer="quit">Stop for now</button>
					<button class="btn btn--ghost" type="button" data-answer="skip">Skip this step</button>
					<button class="btn btn--accent" type="button" data-answer="retry">Check again</button>
				</div>`;
			const copyAll = box.querySelector('[data-copy-all]');
			if (copyAll) copyAll.dataset.copyAll = lines.filter(isCommand).join('\n');
		} else if (prompt.type === 'choose') {
			box.innerHTML = `
				<span class="eyebrow">Pick a drive</span>
				<h2>${escape(data.prompt)}</h2>
				<div class="options">
					${(data.options || []).map((option, index) => `<button class="option" type="button" data-answer="${index + 1}">${escape(option)}</button>`).join('')}
				</div>
				<div class="actions">
					<span class="hint">Not listed? Plug it in and check again.</span>
					<button class="btn btn--ghost" type="button" data-answer="skip">Go without it</button>
					<button class="btn btn--accent" type="button" data-answer="retry">Check again</button>
				</div>`;
		}

		box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	$('prompt').addEventListener('click', async (event) => {
		const copy = event.target.closest('[data-copy], [data-copy-all]');
		if (copy) {
			const text = copy.dataset.copy ?? copy.dataset.copyAll;
			try {
				await navigator.clipboard.writeText(text);
				copy.textContent = 'Copied';
			} catch {
				// Clipboard access needs HTTPS or localhost, so fall back to selecting it
				const range = document.createRange();
				range.selectNodeContents(copy.previousElementSibling || copy.parentElement);
				getSelection().removeAllRanges();
				getSelection().addRange(range);
				copy.textContent = 'Selected';
			}
			setTimeout(() => { copy.textContent = copy.dataset.copyAll !== undefined ? 'Copy commands' : 'Copy'; }, 1500);
			return;
		}
		const button = event.target.closest('[data-answer]');
		if (!button) return;
		for (const b of $('prompt').querySelectorAll('button')) b.disabled = true;
		try {
			await api('/api/answer', { value: button.dataset.answer });
		} catch (error) {
			for (const b of $('prompt').querySelectorAll('button')) b.disabled = false;
			alertLine(error.message);
		}
	});

	function alertLine(text) {
		log(`  ! ${text}`);
	}

	// Finish

	function renderFinish(data, exitCode) {
		const box = $('finish');
		const stopped = !data;
		const skipped = data?.skipped || [];
		const notes = data?.notes || [];
		const check = (data?.mode || mode) === 'check';
		const good = !stopped && skipped.length === 0 && !check;

		box.className = `glass panel finish ${good ? 'good' : ''}`;
		box.hidden = false;
		box.innerHTML = `
			<span class="eyebrow">${stopped ? 'Stopped' : check ? 'Check finished' : good ? 'Done' : 'Finished with steps left'}</span>
			<h2>${stopped ? `Stopped${exitCode ? ` (exit ${exitCode})` : ''}. Progress is saved.` : check ? 'Nothing was changed.' : good ? 'Everything from the backup is in place.' : 'Some steps still need doing.'}</h2>
			${skipped.length ? `<div class="group"><h3>Skipped this run</h3><ul>${skipped.map((s) => `<li>${escape(s)}</li>`).join('')}</ul></div>` : ''}
			${notes.length ? `<div class="group"><h3>Worth knowing</h3><ul>${notes.map((n) => `<li>${escape(n)}</li>`).join('')}</ul></div>` : ''}
			${good ? '<p class="reason" style="margin-top:12px;color:var(--ink-2)">The bak folder can be deleted once you are happy with it.</p>' : ''}
			<div class="actions">
				<button class="btn btn--ghost btn--danger" type="button" id="close-server">Close this page</button>
				${good ? '' : '<button class="btn btn--ghost" type="button" data-rerun="check">Check only</button><button class="btn btn--accent" type="button" data-rerun="run">Run again</button>'}
			</div>`;
		updateStopButton();
	}

	$('finish').addEventListener('click', async (event) => {
		const rerun = event.target.closest('[data-rerun]');
		if (rerun) return begin(rerun.dataset.rerun);
		if (event.target.closest('#close-server')) {
			await api('/api/shutdown', {}).catch(() => {});
			$('conn').className = 'chip lost';
			$('conn-text').textContent = 'Page closed';
			stopPolling = true;
		}
	});

	// Running

	let mode = 'run';
	let running = false;

	function showRun() {
		$('intro').hidden = true;
		$('run').hidden = false;
	}

	async function begin(which) {
		mode = which;
		$('finish').hidden = true;
		states.clear();
		renderPlan();
		try {
			await api('/api/start', { mode: which });
			showRun();
		} catch (error) {
			$('intro-hint').textContent = error.message;
		}
	}

	$('start').addEventListener('click', () => begin('run'));
	$('check').addEventListener('click', () => begin('check'));

	let resetArmed = null;
	$('reset').addEventListener('click', async () => {
		const button = $('reset');
		if (!resetArmed) {
			button.classList.add('armed');
			button.textContent = 'Tap again to forget it';
			resetArmed = setTimeout(() => { resetArmed = null; button.classList.remove('armed'); button.textContent = 'Forget saved progress'; }, 4000);
			return;
		}
		clearTimeout(resetArmed);
		resetArmed = null;
		try {
			await api('/api/reset', {});
			button.hidden = true;
			$('intro-hint').textContent = 'Saved progress forgotten, every step runs again.';
		} catch (error) {
			$('intro-hint').textContent = error.message;
		}
	});

	let stopArmed = null;
	$('stop').addEventListener('click', async () => {
		const button = $('stop');
		if (!stopArmed) {
			button.classList.add('armed');
			button.textContent = 'Tap again to stop';
			stopArmed = setTimeout(() => { stopArmed = null; button.classList.remove('armed'); button.textContent = 'Stop for now'; }, 4000);
			return;
		}
		clearTimeout(stopArmed);
		stopArmed = null;
		button.classList.remove('armed');
		button.textContent = 'Stopping';
		await api('/api/stop', {}).catch(() => {});
	});

	function updateStopButton() {
		$('stop').hidden = !running;
		if (running) $('stop').textContent = 'Stop for now';
	}

	function handle(event) {
		const data = event.data || {};
		switch (event.type) {
			case 'log':
				log(event.text);
				break;
			case 'start':
				mode = data.mode;
				states.clear();
				$('finish').hidden = true;
				$('run-mode').textContent = data.mode === 'check' ? 'Checking' : 'Restoring';
				$('progress-state').textContent = 'Starting';
				log('');
				log(data.mode === 'check' ? 'Check started' : 'Restore started');
				showRun();
				break;
			case 'plan':
				plan = Array.isArray(data) ? data : [];
				renderPlan();
				break;
			case 'step':
				states.set(data.id, data);
				paintStep(data.id, data);
				updateProgress();
				break;
			case 'finish':
				renderFinish(data, 0);
				$('progress-state').textContent = 'Finished';
				break;
			case 'exit':
				running = false;
				if ($('finish').hidden) renderFinish(null, data.code);
				updateStopButton();
				break;
		}
	}

	// Long polling, so a page opened midway, or reloaded, replays everything
	let since = 0;
	let stopPolling = false;

	async function poll() {
		while (!stopPolling) {
			try {
				const snapshot = await api(`/api/events?since=${since}`);
				if (since < snapshot.first) since = snapshot.first;
				for (const event of snapshot.events) handle(event);
				since = snapshot.next;
				running = snapshot.running;
				updateStopButton();
				renderPrompt(snapshot.prompt);
				if (running || snapshot.events.length) showRunIfStarted(snapshot);
				$('conn').className = 'chip live';
				$('conn-text').textContent = running ? 'Running' : 'Connected';
			} catch (error) {
				$('conn').className = 'chip lost';
				$('conn-text').textContent = /code/.test(error.message) ? 'Wrong link' : 'Reconnecting';
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}
	}

	function showRunIfStarted(snapshot) {
		if (snapshot.mode) showRun();
	}

	loadInfo().catch((error) => {
		$('intro-title').textContent = /code/.test(error.message) ? 'Open the link from the terminal' : 'Could not read the backup';
		$('intro-hint').textContent = error.message;
	});
	poll();
})();
</script>
</body>
</html>
RESTORE_PAGE_HTML

	# sudo is unlocked here in the terminal and kept alive, so the page can run
	# the steps that need it without a password ever crossing the network
	local keepalive=""
	if id -nG "$USER" | grep -qwE 'sudo|wheel|admin'; then
		echo
		echo "Some steps need sudo. Enter your password here once, the page cannot ask for it:"
		if sudo -v; then
			( while sleep 50; do sudo -n -v 2>/dev/null || exit; done ) &
			keepalive=$!
		fi
	fi

	local token
	token="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')"

	python3 "$work/server.py" "$PORT" "$token" "$(realpath "$0")" "$BAK" "$work/page.html"
	local code=$?

	[ -n "$keepalive" ] && kill "$keepalive" 2>/dev/null
	rm -rf "$work"
	return $code
}

if [ "$UI" = "web" ]; then
	start_web_ui
	exit $?
fi

OLD_USER="$(mf 'print(m["user"])')"
OLD_HOME="/home/$OLD_USER"
rehome() { local value="$1"; echo "${value//$OLD_HOME/$HOME}"; }

load_nvm() {
	export NVM_DIR="$HOME/.nvm"
	# shellcheck disable=SC1091
	[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
	case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH" ;; esac
}
load_nvm

wants() { mf "print('yes' if any(c['command'] == '$1' for c in m['commands']) else '')" | grep -q yes; }

# Steps: preflight

check_sudo() {
	sudo -n true 2>/dev/null && return 0
	# Check mode cannot prompt, so being allowed to use sudo is enough there
	[ "$MODE" = "check" ] && id -nG "$USER" | grep -qwE 'sudo|wheel|admin' && return 0
	if ! id -nG "$USER" | grep -qwE 'sudo|wheel|admin'; then
		REASON="$USER cannot use sudo, which several steps need"
		FIX="From an account that can: sudo usermod -aG sudo $USER
Then log out and back in"
		return 1
	fi
	REASON="sudo needs your password"
	FIX="Enter it when asked"
	return 1
}
do_sudo() { sudo -v; }

# Bash's own /dev/tcp, since curl is often not installed yet at this point
check_network() {
	if getent hosts github.com >/dev/null 2>&1 && timeout 10 bash -c '</dev/tcp/github.com/443' 2>/dev/null; then return 0; fi
	REASON="Cannot reach github.com, so nothing can be downloaded"
	FIX="Check the network cable or Wi-Fi: ping -c 3 1.1.1.1
Check DNS: getent hosts github.com
If the clock is wrong, HTTPS fails too: timedatectl"
	return 1
}
do_network() { :; }

check_space() {
	local needed free
	needed="$(mf 'b = m.get("documentsBytes") or 0; print(int(b * 1.5 + 8 * 1024**3))')"
	free="$(df -PB1 "$HOME" | awk 'NR==2 {print $4}')"
	[ "$free" -ge "$needed" ] && return 0
	REASON="About $((needed / 1024 / 1024 / 1024)) GB is needed in $HOME, $((free / 1024 / 1024 / 1024)) GB is free"
	FIX="Free up space, or check what is using it: du -sh ~/* | sort -h | tail"
	return 1
}
do_space() { :; }

check_timezone() {
	local wanted current
	wanted="$(mf 'print(m.get("timezone") or "")')"
	[ -z "$wanted" ] && return 0
	current="$(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || readlink /etc/localtime 2>/dev/null | sed 's#.*/zoneinfo/##')"
	[ "$current" = "$wanted" ] && return 0
	REASON="The timezone is $current, the old server used $wanted. Nightly backups and schedules run on local time"
	FIX="sudo timedatectl set-timezone $wanted"
	return 1
}
do_timezone() {
	local wanted
	wanted="$(mf 'print(m.get("timezone") or "")')"
	ask "Set the timezone to $wanted?" || return
	if command -v timedatectl >/dev/null && sudo timedatectl set-timezone "$wanted" 2>/dev/null; then return; fi
	# Without systemd the zone files are set directly
	[ -f "/usr/share/zoneinfo/$wanted" ] || pkg_install tzdata
	sudo ln -sf "/usr/share/zoneinfo/$wanted" /etc/localtime
	echo "$wanted" | sudo tee /etc/timezone >/dev/null
}

# Steps: tools

declare -A PACKAGE=(
	[git]=git [python3]=python3 [curl]=curl [zip]=zip [unzip]=unzip [rsync]=rsync
	[smartctl]=smartmontools [crontab]=cron [findmnt]=util-linux [blkid]=util-linux
)

missing_packages() {
	local command missing=()
	for command in $(mf 'print(" ".join(c["command"] for c in m["commands"]))'); do
		[ -n "${PACKAGE[$command]:-}" ] || continue
		command -v "$command" >/dev/null || missing+=("${PACKAGE[$command]}")
	done
	# Native node modules, like SQLite drivers, need a compiler to install
	if [ "$PKG" = "apt" ] && [ -n "$(mf 'print(len(m["installs"]) or "")')" ] && ! command -v make >/dev/null; then
		missing+=(build-essential)
	fi
	printf '%s\n' "${missing[@]}" | sort -u | tr '\n' ' ' | sed 's/ $//'
}

check_packages() {
	local missing
	missing="$(missing_packages)"
	[ -z "$missing" ] && return 0
	REASON="Missing packages: $missing"
	FIX="$(pkg_install_cmd "$missing")"
	return 1
}
do_packages() {
	local missing
	missing="$(missing_packages)"
	ask "Install $missing?" && pkg_install $missing
}

check_node() {
	load_nvm
	if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
		REASON="nvm is not installed"
		FIX="curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
		return 1
	fi
	local version missing=()
	for version in $(mf 'print(" ".join(m["node"]["nvmVersions"]))'); do
		[ -d "$HOME/.nvm/versions/node/$version" ] || missing+=("$version")
	done
	if [ ${#missing[@]} -gt 0 ]; then
		REASON="Node versions missing: ${missing[*]}"
		FIX="$(printf 'nvm install %s\n' "${missing[@]}")
If a version can no longer be downloaded, install the nearest one with the
same major number, for example: nvm install 22"
		return 1
	fi
	return 0
}
do_node() {
	if [ ! -s "$HOME/.nvm/nvm.sh" ] && ask "Install nvm, the Node version manager?"; then
		curl -fsSo- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
	fi
	load_nvm
	command -v nvm >/dev/null || return
	local version
	for version in $(mf 'print(" ".join(m["node"]["nvmVersions"]))'); do
		[ -d "$HOME/.nvm/versions/node/$version" ] || nvm install "$version"
	done
	nvm alias default "$(mf 'print(m["node"]["current"])')" >/dev/null 2>&1
	load_nvm
}

check_node_link() {
	local target
	target="$(mf 'print(m["node"]["nodeCurrentLink"] or "")')"
	[ -z "$target" ] && return 0
	target="$(rehome "$target")"
	if [ "$(readlink "$HOME/.local/bin/node-current" 2>/dev/null)" = "$target" ] && [ -x "$target" ]; then return 0; fi
	REASON="Cron jobs run node through ~/.local/bin/node-current, which should point at $target"
	FIX="mkdir -p ~/.local/bin && ln -sfn $target ~/.local/bin/node-current"
	return 1
}
do_node_link() {
	local target
	target="$(rehome "$(mf 'print(m["node"]["nodeCurrentLink"] or "")')")"
	[ -x "$target" ] || return
	mkdir -p "$HOME/.local/bin"
	ln -sfn "$target" "$HOME/.local/bin/node-current"
}

missing_global() {
	local tool missing=()
	for tool in bun pnpm pm2; do
		wants "$tool" || continue
		command -v "$tool" >/dev/null || missing+=("$tool")
	done
	echo "${missing[*]}"
}
check_global() {
	load_nvm
	local missing
	missing="$(missing_global)"
	[ -z "$missing" ] && return 0
	REASON="Missing: $missing"
	FIX="npm install -g $missing
If npm says permission denied, node is not coming from nvm. Fix the Node step first."
	return 1
}
do_global() {
	load_nvm
	command -v npm >/dev/null || return
	local missing
	missing="$(missing_global)"
	[ -n "$missing" ] && npm install -g $missing
	load_nvm
}

check_docker() {
	if ! command -v docker >/dev/null; then
		REASON="Docker is not installed"
		FIX="curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker \$USER"
		return 1
	fi
	if ! systemctl is-active --quiet docker 2>/dev/null && ! docker info >/dev/null 2>&1; then
		REASON="Docker is installed but not running"
		FIX="sudo systemctl enable --now docker"
		return 1
	fi
	if ! docker info >/dev/null 2>&1; then
		REASON="$USER is not allowed to use Docker yet"
		FIX="sudo usermod -aG docker \$USER, then log out and back in"
		return 1
	fi
	if ! docker compose version >/dev/null 2>&1; then
		REASON="The docker compose plugin is missing"
		FIX="$(pkg_install_cmd docker-compose-plugin)"
		return 1
	fi
	return 0
}
do_docker() {
	if ! command -v docker >/dev/null; then
		ask "Install Docker with its official install script?" || return
		curl -fsSL https://get.docker.com | sudo sh
		sudo usermod -aG docker "$USER"
	fi
	systemctl is-active --quiet docker 2>/dev/null || sudo systemctl enable --now docker
	if ! docker info >/dev/null 2>&1 && getent group docker | grep -qw "$USER"; then
		# The group only applies to new logins, so the rest of the run
		# continues inside a shell that already has it
		info "Continuing with the docker group applied, no need to log out"
		exec sg docker -c "$(printf '%q ' "$0" "${ORIGINAL_ARGS[@]}")"
	fi
	docker compose version >/dev/null 2>&1 || { ask "Install the docker compose plugin?" && pkg_install docker-compose-plugin; }
}

check_cloudflared_cli() {
	command -v cloudflared >/dev/null && return 0
	REASON="cloudflared is not installed"
	FIX="curl -L -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-\$(dpkg --print-architecture).deb
sudo dpkg -i /tmp/cloudflared.deb"
	return 1
}
do_cloudflared_cli() {
	[ "$PKG" = "apt" ] || return
	ask "Install cloudflared from Cloudflare's releases?" || return
	curl -fL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$(dpkg --print-architecture).deb" && sudo dpkg -i /tmp/cloudflared.deb
}

check_kasa() {
	command -v kasa >/dev/null && return 0
	REASON="kasa, which the lights tool uses to talk to the bulbs, is not installed"
	FIX="$(pkg_install_cmd pipx) && pipx install python-kasa && pipx ensurepath"
	return 1
}
do_kasa() {
	ask "Install python-kasa?" || return
	# Newer distros refuse plain pip installs, pipx is the supported way
	command -v pipx >/dev/null || pkg_install pipx
	if command -v pipx >/dev/null; then
		pipx install python-kasa
	else
		python3 -m pip install --user python-kasa
	fi
	export PATH="$HOME/.local/bin:$PATH"
}

# Steps: code and data

repo_rows() { mf 'for r in m["repos"]: print(r["path"], r["remote"] or "", r["remoteName"] or "origin", r["branch"] or "", r.get("bundle") or "", sep="\x1f")'; }
repo_dir() { if [ "$1" = "." ]; then echo "$DOCUMENTS"; else echo "$DOCUMENTS/$1"; fi; }
is_repo_root() { [ "$(git -C "$1" rev-parse --show-toplevel 2>/dev/null)" = "$(realpath -m "$1")" ]; }

check_repos() {
	local path remote name branch bundle dir bad=()
	while IFS=$'\x1f' read -r path remote name branch bundle; do
		[ -z "$remote" ] && [ -z "$bundle" ] && continue
		dir="$(repo_dir "$path")"
		if ! is_repo_root "$dir"; then bad+=("$path"); continue; fi
		[ -z "$remote" ] && continue
		[ "$(git -C "$dir" remote get-url "$name" 2>/dev/null)" = "$remote" ] || bad+=("$path (different remote)")
	done < <(repo_rows)
	[ ${#bad[@]} -eq 0 ] && return 0
	REASON="Repos not in place: ${bad[*]}"
	FIX="Check GitHub is reachable: git ls-remote <url>
Private repos need you signed in: gh auth login (or set up an SSH key)
A repo that was deleted or renamed can be skipped with s, its files still come back from the backup"
	return 1
}
# Tries GitHub first. When that fails, for a private repo on a machine that
# is not signed in, GitHub being down, or a repo that was deleted, it comes
# from the bundle in the backup instead, with the remote still pointing at
# GitHub so pulls work once signed in
do_repos() {
	local path remote name branch bundle dir target source
	mkdir -p "$DOCUMENTS"
	# Fail straight away rather than asking for a GitHub password
	export GIT_TERMINAL_PROMPT=0
	while IFS=$'\x1f' read -r path remote name branch bundle <&3; do
		[ -z "$remote" ] && [ -z "$bundle" ] && continue
		dir="$(repo_dir "$path")"
		is_repo_root "$dir" && continue

		source="$remote"
		if [ -z "$remote" ] || ! git ls-remote -q "$remote" >/dev/null 2>&1; then
			if [ -n "$bundle" ] && [ -f "$BAK/$bundle" ]; then
				source="$BAK/$bundle"
				info "Restoring $path from the copy in the backup${remote:+, since $remote cannot be reached without signing in}"
			else
				warn "$path cannot be fetched from $remote and there is no copy in the backup"
				continue
			fi
		else
			info "Restoring $path from $remote"
		fi

		# A branch that was renamed since falls back to the source's default
		target="$branch"
		if [ -n "$branch" ] && ! git ls-remote --exit-code --heads "$source" "$branch" >/dev/null 2>&1; then
			target="$(git ls-remote --symref "$source" HEAD 2>/dev/null | awk '/^ref:/ {sub("refs/heads/", "", $2); print $2}')"
			warn "Branch $branch is gone, using ${target:-the default} instead"
		fi

		if [ ! -d "$dir" ] || [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
			git clone -q -o "$name" ${target:+-b "$target"} "$source" "$dir"
		else
			# In place, for a folder that already has files in it, like
			# ~/Documents holding the backup itself
			git -C "$dir" init -q
			git -C "$dir" remote add "$name" "$source" 2>/dev/null || git -C "$dir" remote set-url "$name" "$source"
			git -C "$dir" fetch -q "$name" "+refs/heads/*:refs/remotes/$name/*" && git -C "$dir" checkout -q -f -B "${target:-master}" "$name/${target:-master}"
		fi
		[ -n "$remote" ] && git -C "$dir" remote set-url "$name" "$remote" 2>/dev/null
		if [ "$source" != "$remote" ] && [ -n "$remote" ]; then
			note "$path came from the backup's copy. To pull or push, sign in to GitHub on this machine: gh auth login"
		fi
	done 3< <(repo_rows)

	local exclude="$DOCUMENTS/.git/info/exclude"
	if [ -f "$exclude" ]; then
		grep -qxF "/bak/" "$exclude" || echo "/bak/" >>"$exclude"
		grep -qxF "/documents-*.zip" "$exclude" || echo "/documents-*.zip" >>"$exclude"
	fi
}

# The backup's copy wins over a file git just checked out, since the backup
# holds the uncommitted changes that were on top of it. Anything that already
# exists, is newer than the backup and has been changed here, whether an
# edited tracked file or untracked data, is kept, since it is newer work
data_plan() {
	python3 - "$BAK/documents" "$DOCUMENTS" "$(mf 'print(m["createdAt"])')" "$1" <<'PY'
import os, subprocess, sys
from datetime import datetime
src, dst, created, mode = sys.argv[1:5]
cutoff = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()

# Tracked files exactly as git checked them out, so safe to overwrite
pristine = set()
for root, dirs, files in os.walk(dst):
    if ".git" in dirs or ".git" in files:
        try:
            run = lambda *args: subprocess.run(["git", "-C", root, *args], capture_output=True, text=True).stdout.split("\0")
            modified = {p for p in run("ls-files", "-z", "-m") if p}
            pristine.update(os.path.join(root, p) for p in run("ls-files", "-z") if p and p not in modified)
        except Exception:
            pass
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]

copy, kept, bad = [], [], 0
for root, dirs, files in os.walk(src):
    for name in files:
        a = os.path.join(root, name)
        rel = os.path.relpath(a, src)
        b = os.path.join(dst, rel)
        same = os.path.lexists(b) and (os.path.islink(a) or (os.path.isfile(b) and os.path.getsize(a) == os.path.getsize(b)))
        if same:
            continue
        if os.path.exists(b) and b not in pristine and os.path.getmtime(b) > cutoff:
            kept.append(rel)
            continue
        copy.append(rel)
if mode == "copy":
    print("\n".join(copy))
elif mode == "kept":
    print("\n".join(kept))
else:
    print(len(copy))
PY
}

check_data() {
	local missing
	missing="$(data_plan count)"
	[ "$missing" = "0" ] && return 0
	REASON="$missing files from the backup are not in ~/Documents yet"
	FIX="If copying failed with permission denied: sudo chown -R \$USER ~/Documents
If the disk is full: df -h ~"
	return 1
}
do_data() {
	local list kept
	list="$(mktemp)"
	data_plan copy >"$list"
	info "Copying $(wc -l <"$list") files into $DOCUMENTS"
	if command -v rsync >/dev/null; then
		rsync -a --files-from="$list" "$BAK/documents/" "$DOCUMENTS/"
	else
		(cd "$BAK/documents" && while IFS= read -r file; do mkdir -p "$DOCUMENTS/$(dirname "$file")"; cp -a "$file" "$DOCUMENTS/$file"; done <"$list")
	fi
	rm -f "$list"
	kept="$(data_plan kept)"
	if [ -n "$kept" ]; then
		note "$(echo "$kept" | wc -l) files were newer here than in the backup and were kept, for example: $(echo "$kept" | head -3 | tr '\n' ' ')"
	fi
}

check_home() {
	local item bad=()
	for item in $(mf 'print(" ".join(m["home"]))'); do
		diff -rq "$BAK/home/$item" "$HOME/$item" >/dev/null 2>&1 || bad+=("$item")
	done
	[ ${#bad[@]} -eq 0 ] && return 0
	REASON="Home files not restored: ${bad[*]}"
	FIX="rsync -a \"$BAK/home/\" \"$HOME/\""
	return 1
}
do_home() {
	local item
	for item in $(mf 'print(" ".join(m["home"]))'); do
		diff -rq "$BAK/home/$item" "$HOME/$item" >/dev/null 2>&1 && continue
		if [ -e "$HOME/$item" ]; then
			cp -a "$HOME/$item" "$HOME/$item.before-restore"
			info "Kept the existing ~/$item as ~/$item.before-restore"
		fi
		mkdir -p "$(dirname "$HOME/$item")"
		rsync -a "$BAK/home/$item" "$(dirname "$HOME/$item")/" 2>/dev/null || cp -a "$BAK/home/$item" "$(dirname "$HOME/$item")/"
	done
	[ -d "$HOME/.ssh" ] && chmod 700 "$HOME/.ssh"
	[ -f "$HOME/.ssh/authorized_keys" ] && chmod 600 "$HOME/.ssh/authorized_keys"
	[ -d "$HOME/.cloudflared" ] && chmod 700 "$HOME/.cloudflared"

	# The shell config expects oh-my-zsh and its theme, which are not files
	# worth backing up since they install in a minute
	if grep -q "oh-my-zsh" "$HOME/.zshrc" 2>/dev/null && [ ! -d "$HOME/.oh-my-zsh" ]; then
		note "~/.zshrc uses oh-my-zsh, which is not installed: sh -c \"\$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)\" \"\" --keep-zshrc"
	fi
	if grep -q "powerlevel10k" "$HOME/.zshrc" 2>/dev/null && [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ]; then
		note "~/.zshrc uses the powerlevel10k theme: git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \${ZSH_CUSTOM:-\$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
	fi
}

install_rows() { mf 'for i in m["installs"]: print(i["path"], i["manager"], sep="\x1f")'; }

check_installs() {
	local path manager bad=()
	while IFS=$'\x1f' read -r path manager; do
		[ -d "$DOCUMENTS/$path" ] || continue
		[ -d "$DOCUMENTS/$path/node_modules" ] || bad+=("$path")
	done < <(install_rows)
	[ ${#bad[@]} -eq 0 ] && return 0
	REASON="Packages not installed in: ${bad[*]}"
	FIX="The errors above say what failed. Common causes:
- a missing compiler for native modules: $(pkg_install_cmd build-essential python3)
- a project that needs another Node version: cd <folder> && nvm exec <version> npm install"
	return 1
}

run_install() {
	local manager="$1"
	case "$manager" in
		bun) bun install ;;
		pnpm) pnpm install --frozen-lockfile || pnpm install ;;
		npm) npm ci || npm install ;;
	esac
}

do_installs() {
	load_nvm
	local path manager version
	while IFS=$'\x1f' read -r path manager; do
		[ -d "$DOCUMENTS/$path" ] || continue
		[ -d "$DOCUMENTS/$path/node_modules" ] && continue
		info "Installing packages in $path with $manager"
		if ! (cd "$DOCUMENTS/$path" && run_install "$manager"); then
			# Some projects need a different Node, so each installed version
			# is tried, newest first
			for version in $(ls -1r "$HOME/.nvm/versions/node" 2>/dev/null); do
				info "Retrying $path with Node $version"
				(cd "$DOCUMENTS/$path" && nvm exec "$version" bash -c "$(declare -f run_install); run_install $manager") && break
			done
		fi
	done < <(install_rows)
}

# Steps: system

saved_crontab() { sed "s#$OLD_HOME#$HOME#g" "$BAK/system/crontab.txt"; }
CRON_KEPT=""

check_crontab() {
	if ! systemctl is-active --quiet cron 2>/dev/null && ! systemctl is-active --quiet crond 2>/dev/null; then
		REASON="The cron service is not running, so scheduled jobs never fire"
		FIX="sudo systemctl enable --now cron"
		return 1
	fi
	[ -n "$CRON_KEPT" ] && return 0
	diff -q <(crontab -l 2>/dev/null) <(saved_crontab) >/dev/null && return 0
	REASON="The crontab does not match the backup"
	FIX="crontab \"$BAK/system/crontab.txt\""
	return 1
}
do_crontab() {
	if ! systemctl is-active --quiet cron 2>/dev/null && ! systemctl is-active --quiet crond 2>/dev/null; then
		sudo systemctl enable --now cron 2>/dev/null || sudo systemctl enable --now crond 2>/dev/null
	fi
	diff -q <(crontab -l 2>/dev/null) <(saved_crontab) >/dev/null && return
	local current
	current="$(crontab -l 2>/dev/null)"
	if [ -n "$current" ]; then
		echo "  This machine already has a crontab. Differences from the backup:"
		diff <(echo "$current") <(saved_crontab) | sed 's/^/    /'
		if ! ask "Replace it with the backup's? The current one is saved to ~/crontab.before-restore" n; then
			CRON_KEPT="yes"
			return
		fi
		echo "$current" >"$HOME/crontab.before-restore"
	fi
	saved_crontab | crontab -

	grep -vE '^\s*(#|$)' <(saved_crontab) | grep -oE '(~|/)[^ "]+\.(sh|js|mjs|py)' | sort -u | while read -r file; do
		[ -e "${file/#\~/$HOME}" ] || note "A cron job runs $file, which does not exist yet (is its drive mounted?)"
	done
}

fstab_rows() { mf 'for e in m["fstab"]["extra"]: print(e["mount"], e["source"], e["uuid"] or "", e["label"] or "", e["type"] or "auto", e["fstype"] or "", e["line"], sep="\x1f")'; }
in_fstab() { awk '!/^[[:space:]]*#/ {print $2}' /etc/fstab | grep -qxF "$1"; }
DRIVES_SKIPPED=""

check_fstab() {
	local mount source uuid label type fstype line bad=()
	while IFS=$'\x1f' read -r mount source uuid label type fstype line; do
		findmnt -rn "$mount" >/dev/null && continue
		[[ " $DRIVES_SKIPPED " == *" $mount "* ]] && continue
		bad+=("$mount${label:+ ($label)}")
	done < <(fstab_rows)
	[ ${#bad[@]} -eq 0 ] && return 0
	REASON="Drives not mounted: ${bad[*]}"
	FIX="Plug the drives in and press Enter, this step then finds them.
A replacement drive can be picked when it asks. A drive gone for good can be skipped."
	return 1
}

# Unmounted partitions with a filesystem that fstab does not already use
candidate_drives() {
	# lsblk -P quotes every field, so empty labels do not shift the columns
	lsblk -rpnPo PATH,UUID,FSTYPE,SIZE,LABEL,MOUNTPOINT,TYPE 2>/dev/null | while read -r row; do
		local PATH_="" UUID="" FSTYPE="" SIZE="" LABEL="" MOUNTPOINT="" TYPE=""
		eval "$(echo "$row" | sed 's/\bPATH=/PATH_=/')"
		[ "$TYPE" = "part" ] && [ -n "$UUID" ] && [ -z "$MOUNTPOINT" ] || continue
		grep -q "$UUID" /etc/fstab && continue
		printf '%s\x1f%s\x1f%s\x1f%s\x1f%s\n' "$PATH_" "$UUID" "$FSTYPE" "$SIZE" "$LABEL"
	done
}

blank_drives() {
	lsblk -rpdno PATH,SIZE,TYPE,TRAN 2>/dev/null | awk '$3 == "disk"' | while read -r path size type tran; do
		[ -z "$(lsblk -rno FSTYPE "$path" | tr -d '[:space:]')" ] && echo "$path ($size${tran:+, $tran})"
	done
}

add_fstab_line() {
	local entry="$1" mount="$2"
	echo "  Adding to /etc/fstab: $entry"
	ask "Add this line?" || return 1
	[ -f /etc/fstab.before-restore ] || sudo cp /etc/fstab /etc/fstab.before-restore
	echo "$entry" | sudo tee -a /etc/fstab >/dev/null
	sudo systemctl daemon-reload 2>/dev/null
	return 0
}

# Keeps the old options, but always with nofail, so a missing drive can
# never stop the machine from booting
options_with_nofail() {
	local options="$1"
	[[ ",$options," == *",nofail,"* ]] && echo "$options" || echo "$options,nofail"
}

do_fstab() {
	local mount source uuid label type fstype line fields options dump pass entry
	while IFS=$'\x1f' read -r mount source uuid label type fstype line <&3; do
		findmnt -rn "$mount" >/dev/null && continue
		[[ " $DRIVES_SKIPPED " == *" $mount "* ]] && continue

		read -ra fields <<<"$line"
		options="$(options_with_nofail "${fields[3]:-defaults}")"
		dump="${fields[4]:-0}"
		pass="${fields[5]:-0}"

		# The same drive, found by its UUID or a stable path. A bare name like
		# /dev/sda2 is not trusted, since on another machine, or after a
		# replug, it can belong to a different drive entirely
		entry=""
		if [ -n "$uuid" ] && [ -e "/dev/disk/by-uuid/$uuid" ]; then
			entry="UUID=$uuid $mount $type $options $dump $pass"
		elif [ -e "$source" ] && ! [[ "$source" =~ ^/dev/(sd|hd|vd|nvme|mmcblk) ]]; then
			entry="$source $mount $type $options $dump $pass"
		fi

		# Not there, so offer the drives that are, as a replacement
		if [ -z "$entry" ]; then
			echo
			echo "  ${BOLD}$mount${RESET}${label:+ ($label)} is not connected. It was a ${fstype:-$type} drive${uuid:+ with UUID $uuid}."
			local candidates=()
			mapfile -t candidates < <(candidate_drives)
			if [ ${#candidates[@]} -gt 0 ]; then
				echo "  Is one of these its replacement?"
				local i
				for i in "${!candidates[@]}"; do
					IFS=$'\x1f' read -r c_path c_uuid c_fs c_size c_label <<<"${candidates[$i]}"
					echo "    $((i + 1))) $c_path  $c_size  $c_fs${c_label:+  \"$c_label\"}"
				done
				local choice="s"
				# Unattended runs never guess which drive is which
				if [ "$UI" = "child" ]; then
					local options=()
					for i in "${!candidates[@]}"; do
						IFS=$'\x1f' read -r c_path c_uuid c_fs c_size c_label <<<"${candidates[$i]}"
						options+=("$c_path  $c_size  $c_fs${c_label:+  \"$c_label\"}")
					done
					emit CHOOSE "$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1], "options": sys.argv[2:]}))' "$mount${label:+ ($label)} is not connected. Is one of these its replacement?" "${options[@]}")"
					choice="$(ui_read)"
					[ "$choice" = "retry" ] && choice=""
					[ "$choice" = "skip" ] && choice="s"
				elif [ -z "$UNATTENDED" ]; then
					read -r -p "  Number, Enter to check again after plugging it in, or s to go without it: " choice </dev/tty
				fi
				if [[ "$choice" =~ ^[0-9]+$ ]] && [ -n "${candidates[$((choice - 1))]:-}" ]; then
					IFS=$'\x1f' read -r c_path c_uuid c_fs c_size c_label <<<"${candidates[$((choice - 1))]}"
					local c_type="$type"
					# A different filesystem needs its own type, and ext4
					# options like errors= do not apply to NTFS
					if [ "$type" != "auto" ] && [ "$c_fs" != "$type" ]; then c_type="$c_fs"; options="defaults,nofail"; fi
					entry="UUID=$c_uuid $mount $c_type $options $dump $pass"
					note "$mount now uses $c_path (UUID $c_uuid) in place of the old drive. Anything that lived on the old drive, like containers, starts empty."
				elif [[ "$choice" =~ ^[sS]$ ]]; then
					DRIVES_SKIPPED+=" $mount"
					note "$mount was skipped. Anything that used it, like containers or cron jobs, will not work until it is set up."
					continue
				else
					continue
				fi
			else
				local blank
				blank="$(blank_drives)"
				if [ -n "$blank" ]; then
					echo "  These drives have no filesystem yet:"
					echo "$blank" | sed 's/^/    /'
					echo "  To use one as $mount, format it. ${RED}This erases the drive${RESET}, so check the name carefully:"
					echo "    sudo parted /dev/sdX --script mklabel gpt mkpart primary ext4 0% 100%"
					echo "    sudo mkfs.ext4 -L ${label:-$(basename "$mount")} /dev/sdX1"
					echo "  Then press Enter when this step asks, and pick it from the list."
				fi
				continue
			fi
		fi

		if ! in_fstab "$mount"; then
			add_fstab_line "$entry" "$mount" || continue
		fi

		if [ -d "$mount" ] && [ -n "$(ls -A "$mount" 2>/dev/null)" ]; then
			warn "$mount already has files in it. They are hidden, not deleted, while the drive is mounted over them."
		fi
		sudo mkdir -p "$mount"
		if ! sudo mount "$mount"; then
			info "Mounting $mount failed. The last kernel messages:"
			sudo dmesg | tail -5 | sed 's/^/      /'
			[ "$fstype" = "ntfs" ] || [ "$type" = "ntfs" ] && info "For NTFS drives not shut down cleanly: sudo ntfsfix <device>"
		fi
	done 3< <(fstab_rows)
}

has_cloudflared() { mf 'print("yes" if m.get("cloudflared") else "")' | grep -q yes; }
cloudflared_config() { sed "s#$OLD_HOME#$HOME#g" "$BAK/system/cloudflared/config.yml"; }

check_cloudflared() {
	local creds
	creds="$(rehome "$(mf 'print(m["cloudflared"]["credentialsFile"] or "")')")"
	if ! diff -q <(cloudflared_config) /etc/cloudflared/config.yml >/dev/null 2>&1; then
		REASON="/etc/cloudflared/config.yml does not match the backup"
		FIX="sudo mkdir -p /etc/cloudflared && sudo cp \"$BAK/system/cloudflared/config.yml\" /etc/cloudflared/config.yml"
		return 1
	fi
	if [ -n "$creds" ] && [ ! -f "$creds" ]; then
		REASON="The tunnel credentials file $creds is missing, so the tunnel cannot connect"
		FIX="It comes back with the home files step. If that is lost too, make a new tunnel:
cloudflared tunnel login
cloudflared tunnel create <name>
then put its ID and credentials path in /etc/cloudflared/config.yml and point
the DNS records at it: cloudflared tunnel route dns <name> <hostname>"
		return 1
	fi
	if ! systemctl is-active --quiet cloudflared; then
		REASON="The cloudflared service is not running"
		FIX="sudo cloudflared service install && sudo systemctl enable --now cloudflared
See why it stopped: journalctl -u cloudflared -n 30"
		return 1
	fi
	return 0
}
do_cloudflared() {
	if ! diff -q <(cloudflared_config) /etc/cloudflared/config.yml >/dev/null 2>&1; then
		sudo mkdir -p /etc/cloudflared
		[ -f /etc/cloudflared/config.yml ] && sudo cp -n /etc/cloudflared/config.yml /etc/cloudflared/config.yml.before-restore
		cloudflared_config | sudo tee /etc/cloudflared/config.yml >/dev/null
	fi
	systemctl cat cloudflared >/dev/null 2>&1 || sudo cloudflared service install
	sudo systemctl enable --now cloudflared
	sudo systemctl restart cloudflared
	sleep 3
	note "If the old server is still switched on and connected, Cloudflare splits traffic between both tunnels. Turn the old one off, or stop its cloudflared."
}

# Steps: services

compose_rows() { mf 'for c in m["docker"]["compose"]: print(c["project"], c["workingDir"], ",".join(c["configFiles"]), ",".join(c["containers"]), sep="\x1f")'; }
running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }
was_stopped() { mf "print('yes' if '$1' in m['docker'].get('stopped', []) else '')" | grep -q yes; }
# Running, or deliberately stopped at backup time and so not expected to be
wanted_state() { running "$1" || { was_stopped "$1" && docker inspect "$1" >/dev/null 2>&1; }; }

check_compose() {
	local project dir files containers container bad=()
	while IFS=$'\x1f' read -r project dir files containers; do
		for container in ${containers//,/ }; do
			wanted_state "$container" || { bad+=("$project"); break; }
		done
	done < <(compose_rows)
	[ ${#bad[@]} -eq 0 ] && return 0
	REASON="Compose projects not running: ${bad[*]}"
	FIX="The docker compose errors above say what went wrong. Common causes:
- the project is on a drive that is not mounted yet (see the Drives step)
- a port is already taken: sudo ss -ltnp | grep :<port>
- Docker Hub rate limits: docker login
- a network defined as external is missing: docker network create <name>"
	return 1
}

# A volume is only filled from the backup while it is empty, so data a
# container already wrote is never replaced
restore_volume() {
	local volume="$1" tar="$2"
	[ -f "$tar" ] || return 0
	if [ -n "$(docker run --rm -v "$volume":/v alpine sh -c 'ls -A /v | head -1' 2>/dev/null)" ]; then
		return 0
	fi
	info "Restoring the $volume volume from the backup"
	docker run --rm -v "$volume":/v -v "$(dirname "$tar")":/b:ro alpine \
		sh -c "mkdir -p /t && tar -xf \"/b/$(basename "$tar")\" -C /t && cp -a /t/*/. /v/"
}

do_compose() {
	local project dir files containers container original saved args file volume tar
	while IFS=$'\x1f' read -r project dir files containers <&3; do
		local all_right="yes"
		for container in ${containers//,/ }; do wanted_state "$container" || all_right=""; done
		[ -n "$all_right" ] && continue

		dir="$(rehome "$dir")"
		local top
		top="$(echo "$dir" | cut -d/ -f1-3)"
		if [[ "$dir" == /media/* || "$dir" == /mnt/* ]] && ! findmnt -rn "$top" >/dev/null; then
			info "$project lives on $top, which is not mounted, so it waits for the Drives step"
			continue
		fi
		mkdir -p "$dir" 2>/dev/null || sudo mkdir -p "$dir"

		# Compose files and .env files come back only where they are missing
		while IFS=$'\x1f' read -r original saved; do
			original="$(rehome "$original")"
			[ -f "$original" ] && continue
			cp -a "$BAK/$saved" "$original" 2>/dev/null || sudo cp -a "$BAK/$saved" "$original"
			info "Put back $original"
		done < <(mf "
for c in m['docker']['compose']:
    if c['project'] == '$project':
        for f in c['files']: print(f['original'], f['saved'], sep='\x1f')")

		args=()
		for file in ${files//,/ }; do args+=(-f "$(rehome "$file")"); done

		info "Starting $project"
		(cd "$dir" && docker compose "${args[@]}" pull && docker compose "${args[@]}" create) || continue

		while IFS=$'\x1f' read -r volume tar; do
			restore_volume "$volume" "$BAK/$tar"
		done < <(mf "
for v in m['docker']['volumes']:
    for c in m['docker']['compose']:
        if c['project'] == '$project' and v['container'] in c['containers']:
            print(v['name'], v['saved'], sep='\x1f')")

		(cd "$dir" && docker compose "${args[@]}" up -d)

		# Compose starts everything, so the ones that were off go back off
		for container in ${containers//,/ }; do
			if was_stopped "$container" && running "$container"; then
				docker stop "$container" >/dev/null
				info "Stopped $container again, it was off in the backup"
			fi
		done
	done 3< <(compose_rows)
}

standalone_rows() { mf 'for s in m["docker"]["standalone"]: print(s["name"], s["run"], sep="\x1f")'; }

check_standalone() {
	local name command bad=()
	while IFS=$'\x1f' read -r name command; do
		wanted_state "$name" || bad+=("$name")
	done < <(standalone_rows)
	[ ${#bad[@]} -eq 0 ] && return 0
	REASON="Containers not running: ${bad[*]}"
	FIX="$(standalone_rows | while IFS=$'\x1f' read -r name command; do running "$name" || rehome "$command"; done)"
	return 1
}
do_standalone() {
	local name command bind
	while IFS=$'\x1f' read -r name command <&3; do
		wanted_state "$name" && continue
		command="$(rehome "$command")"
		if docker inspect "$name" >/dev/null 2>&1; then
			was_stopped "$name" || docker start "$name"
			continue
		fi
		# Folders mapped into the container are made first, as this user,
		# or Docker creates them owned by root
		for bind in $(echo "$command" | grep -oE -- "-v [^ ]+" | cut -d' ' -f2 | cut -d: -f1); do
			[[ "$bind" == /* ]] || continue
			[ -e "$bind" ] || mkdir -p "$bind" 2>/dev/null || sudo mkdir -p "$bind"
		done
		echo "  $name was started by hand, not with compose. It was run as:"
		echo "    $command"
		ask "Run it now?" && eval "$command"
	done 3< <(standalone_rows)
}

app_names() { mf 'print(" ".join(a["name"] for a in m["pm2"]["apps"]))'; }

pm2_online() {
	pm2 jlist 2>/dev/null | python3 -c 'import json,sys; print(" ".join(a["name"] for a in json.load(sys.stdin) if a["pm2_env"]["status"] == "online"))' 2>/dev/null
}

pm2_restarts() {
	pm2 jlist 2>/dev/null | python3 -c 'import json,sys; print(" ".join(f"{a[\"name\"]}={a[\"pm2_env\"][\"restart_time\"]}" for a in json.load(sys.stdin)))' 2>/dev/null
}

check_pm2() {
	load_nvm
	command -v pm2 >/dev/null || { REASON="pm2 is not installed"; FIX="npm install -g pm2"; return 1; }
	local online bad=() app
	online="$(pm2_online)"
	for app in $(app_names); do [[ " $online " == *" $app "* ]] || bad+=("$app"); done
	if [ ${#bad[@]} -gt 0 ]; then
		REASON="pm2 apps not online: ${bad[*]}"
		FIX="See why with: pm2 logs <name> --lines 50
The usual causes are a missing .env value, a failed build, or a port in use."
		return 1
	fi
	# Online can still mean restarting in a loop, so restart counts are
	# compared across a few seconds
	local before after
	before="$(pm2_restarts)"; sleep 8; after="$(pm2_restarts)"
	if [ "$before" != "$after" ]; then
		REASON="Some pm2 apps keep restarting: $(diff <(echo "$before" | tr ' ' '\n') <(echo "$after" | tr ' ' '\n') | awk '/^>/ {print $2}' | cut -d= -f1 | tr '\n' ' ')"
		FIX="pm2 logs <name> --lines 50"
		return 1
	fi
	if ! systemctl is-enabled --quiet "pm2-$USER" 2>/dev/null; then
		REASON="pm2 is not set to start at boot"
		FIX="sudo env PATH=\"\$PATH\" \"\$(command -v pm2)\" startup systemd -u $USER --hp $HOME && pm2 save"
		return 1
	fi
	return 0
}
do_pm2() {
	load_nvm
	local script online
	script="$(mf 'print(m["pm2"]["startScript"] or "")')"
	online="$(pm2_online)"
	if [ -n "$script" ] && [ -f "$DOCUMENTS/$script" ]; then
		# The start script stops and rebuilds every app, which is a brief
		# outage on a machine that is already running
		if [ -n "$online" ] && ! ask "Apps are already running. Run $script, which restarts all of them?" n; then
			return
		fi
		echo "  Running $script, which builds each tool and starts it with pm2. This takes a while."
		(cd "$(dirname "$DOCUMENTS/$script")" && bash "$DOCUMENTS/$script")
	elif [ -f "$BAK/system/pm2/dump.pm2" ]; then
		mkdir -p "$HOME/.pm2"
		[ -f "$HOME/.pm2/dump.pm2" ] || cp "$BAK/system/pm2/dump.pm2" "$HOME/.pm2/dump.pm2"
		pm2 resurrect
	fi
	if ! systemctl is-enabled --quiet "pm2-$USER" 2>/dev/null; then
		sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME"
	fi
	pm2 save
}

# The website runs smartctl through sudo with a password kept in its .env.
# A new machine usually has a new password, which would fail silently
check_server_password() {
	local env="$DOCUMENTS/website/.env" encoded
	[ -f "$env" ] || return 0
	encoded="$(grep -E '^SERVER_PASSWORD=' "$env" | head -1 | cut -d= -f2- | tr -d '"')"
	[ -z "$encoded" ] && return 0
	if echo "$encoded" | base64 -d 2>/dev/null | sudo -S -k -v >/dev/null 2>&1; then return 0; fi
	REASON="SERVER_PASSWORD in website/.env is not this machine's sudo password, so drive health checks cannot run"
	FIX="Update it with your password, then restart the website:
sed -i \"s|^SERVER_PASSWORD=.*|SERVER_PASSWORD=\\\"\$(read -rsp 'Password: ' p; echo -n \"\$p\" | base64)\\\"|\" ~/Documents/website/.env
pm2 restart xtrendence.com"
	return 1
}
do_server_password() { :; }

# Running it

heading "Restoring from $(dirname "$BAK")"
info "Backup made $(mf 'print(m["createdAt"][:16].replace("T", " "))') UTC on $(mf 'print(m["hostname"])') ($(mf 'print(m["os"] or "unknown OS")'))"
[ "$OLD_HOME" != "$HOME" ] && info "Paths under $OLD_HOME are moved to $HOME"
[ "$(mf 'print(m.get("arch") or "")')" != "" ] && [ "$(mf 'print(m.get("arch"))')" != "$(node -p process.arch 2>/dev/null || uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" ] && warn "This machine's CPU type differs from the old one. Most things work, but some Docker images or tools may not exist for it."
[ "$MODE" = "check" ] && info "Check only, nothing will be changed"

# Every step is listed before any runs, so the page can show all of them
PLAN=()
section() { PLAN+=("section$(printf '\x1f')$1"); }
add() { PLAN+=("step$(printf '\x1f')$1$(printf '\x1f')$2$(printf '\x1f')$3$(printf '\x1f')$4"); }

section "Before starting"
add sudo "sudo access" check_sudo do_sudo
add network "Internet access" check_network do_network
add space "Free disk space" check_space do_space
add timezone "Timezone" check_timezone do_timezone

section "Tools"
add packages "Basic packages" check_packages do_packages
add node "Node through nvm" check_node do_node
add node_link "node-current link for cron" check_node_link do_node_link
add global "bun, pnpm and pm2" check_global do_global
wants docker && add docker "Docker" check_docker do_docker
has_cloudflared && add cloudflared_cli "cloudflared" check_cloudflared_cli do_cloudflared_cli
wants kasa && add kasa "python-kasa" check_kasa do_kasa

section "Code and data"
add repos "Repos" check_repos do_repos
add data "User data from the backup" check_data do_data
add home "Home folder files" check_home do_home
add installs "Package installs" check_installs do_installs

section "System"
add fstab "Drives" check_fstab do_fstab
add crontab "Crontab" check_crontab do_crontab
has_cloudflared && add cloudflared "Cloudflare tunnel" check_cloudflared do_cloudflared

section "Services"
if wants docker; then
	add compose "Docker compose projects" check_compose do_compose
	add standalone "Other containers" check_standalone do_standalone
fi
add pm2 "pm2 apps" check_pm2 do_pm2
add server_password "Website sudo password" check_server_password do_server_password

emit PLAN "$(printf '%s\n' "${PLAN[@]}" | python3 -c '
import json, sys
plan = []
for line in sys.stdin.read().splitlines():
    parts = line.split("\x1f")
    if parts[0] == "section":
        plan.append({"section": parts[1], "steps": []})
    else:
        plan[-1]["steps"].append({"id": parts[1], "title": parts[2]})
print(json.dumps(plan))')"

for entry in "${PLAN[@]}"; do
	IFS=$'\x1f' read -r kind a b c d <<<"$entry"
	if [ "$kind" = "section" ]; then heading "$a"; else step "$a" "$b" "$c" "$d"; fi
done

heading "Left out of the backup on purpose"
mf '
for s in m["docker"]["skipped"]:
    print("    " + s["name"] + " (" + s["container"] + "): " + s["reason"])
'
info "These are large and can be downloaded or rebuilt, so a container using one starts empty."
info "Router settings, like a VPN port forward, live on the router and need setting up there."

if [ ${#NOTES[@]} -gt 0 ]; then
	heading "Worth knowing"
	printf '    - %s\n' "${NOTES[@]}"
fi

# One summary for the page, with the notes and skipped steps as lists
emit FINISH "$(python3 -c '
import json, sys
notes, skipped, mode = sys.argv[1], sys.argv[2], sys.argv[3]
split = lambda text: [line for line in text.split("\x1f") if line]
print(json.dumps({"notes": split(notes), "skipped": split(skipped), "mode": mode}))' "$(printf '%s\x1f' "${NOTES[@]}")" "$(printf '%s\x1f' "${SKIPPED[@]}")" "$MODE")"

if [ ${#SKIPPED[@]} -gt 0 ]; then
	heading "Skipped this run"
	printf '    - %s\n' "${SKIPPED[@]}"
	info "Run ./restore.sh again once they are sorted, finished steps are not redone."
elif [ "$MODE" = "run" ]; then
	heading "Done"
	info "Everything from the backup is in place. bak/ can be deleted once you are happy with it."
fi
