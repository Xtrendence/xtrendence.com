#!/bin/bash
# Checks connectivity on whichever interface currently carries the uplink
# and resets that interface when it stops responding

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PATH="$SCRIPT_DIR/network.log"
STATE_PATH="$SCRIPT_DIR/.state"
LOCK_PATH="$SCRIPT_DIR/.lock"

MAX_LOG_KB=1000
PING_COUNT=2
PING_DEADLINE=5
MAX_TARGETS=3

TARGETS=(1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 9.9.9.9)

# Virtual and container interfaces never carry the uplink
SKIP_PATTERN='^(lo|docker[0-9]*|br-|veth|virbr|tun|tap|p2p-)'

log() {
	printf '%s - %s\n' "$(date +'%m-%d %r')" "$1" >> "$LOG_PATH"
}

rotate_log() {
	[ -f "$LOG_PATH" ] || return 0
	local kb
	kb=$(du -k "$LOG_PATH" 2>/dev/null | cut -f1)
	if [ -n "$kb" ] && [ "$kb" -ge "$MAX_LOG_KB" ]; then
		: > "$LOG_PATH"
		log "Log truncated at ${MAX_LOG_KB}KB"
	fi
}

# Prefers the default route, falls back to any physical link with carrier
detect_interface() {
	local iface name path
	iface=$(ip -4 route show default 2>/dev/null | sed -n 's/.*dev \([^ ]*\).*/\1/p' | head -1)
	if [ -n "$iface" ]; then
		printf '%s' "$iface"
		return 0
	fi
	for path in /sys/class/net/*; do
		name=${path##*/}
		[[ $name =~ $SKIP_PATTERN ]] && continue
		[ -e "$path/device" ] || continue
		[ "$(cat "$path/carrier" 2>/dev/null)" = "1" ] || continue
		printf '%s' "$name"
		return 0
	done
	return 1
}

# Stops at the first target that replies so one dead resolver is not an outage
check_connectivity() {
	local iface=$1 target tried=0
	while read -r target; do
		tried=$((tried + 1))
		[ "$tried" -gt "$MAX_TARGETS" ] && break
		if ping -c "$PING_COUNT" -w "$PING_DEADLINE" -I "$iface" "$target" >/dev/null 2>&1; then
			printf '%s' "$target"
			return 0
		fi
	done < <(shuf -e "${TARGETS[@]}")
	return 1
}

# Runs a privileged command directly or via passwordless sudo
as_root() {
	if "$@" >/dev/null 2>&1; then
		return 0
	fi
	[ "$(id -u)" -eq 0 ] && return 1
	sudo -n "$@" >/dev/null 2>&1
}

reset_interface() {
	local iface=$1 quiet=${2:-0} method=""
	if command -v nmcli >/dev/null 2>&1 && as_root nmcli device reconnect "$iface"; then
		method="nmcli"
	elif as_root ip link set "$iface" down; then
		sleep 5
		as_root ip link set "$iface" up
		method="ip link"
	fi
	[ "$quiet" -eq 1 ] && return 0
	if [ -n "$method" ]; then
		log "Reset $iface via $method"
	else
		log "Reset of $iface failed, needs root privileges"
	fi
}

# Returns 0 when the state changed so callers can log transitions only
record_state() {
	local state=$1 detail=$2 previous=""
	[ -f "$STATE_PATH" ] && previous=$(cat "$STATE_PATH" 2>/dev/null)
	printf '%s' "$state" > "$STATE_PATH"
	[ "$state" = "$previous" ] && return 1
	log "$detail"
	return 0
}

main() {
	rotate_log

	local iface target changed
	if ! iface=$(detect_interface); then
		record_state down "No active network interface found"
		return 1
	fi

	if target=$(check_connectivity "$iface"); then
		record_state up "Network is up on $iface (used $target)"
		return 0
	fi

	record_state down "Network is down on $iface, resetting"
	changed=$?
	reset_interface "$iface" "$changed"
	return 1
}

exec 9>"$LOCK_PATH"
flock -n 9 || exit 0

main
