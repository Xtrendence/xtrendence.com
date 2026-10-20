#!/bin/bash
# Keeps the server online at 192.168.1.125, on ethernet and on WiFi only while ethernet cannot reach the router

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PATH="$SCRIPT_DIR/network.log"
STATE_PATH="$SCRIPT_DIR/.state"
UPLINK_PATH="$SCRIPT_DIR/.uplink"
RESET_PATH="$SCRIPT_DIR/.last-reset"
RETRY_PATH="$SCRIPT_DIR/.last-retry"
LOCK_PATH="$SCRIPT_DIR/.lock"

# Fixed, since the sudoers rule in /etc/sudoers.d/wifi-check only allows these
ETH=enp1s0
WIFI=wlp0s20f3
# Both profiles use 192.168.1.125, so only one of them may ever be up at a time
WIFI_CONNECTION=dfd909d2-e774-400d-91ad-6f413b36e352

MAX_LOG_KB=1000
PING_COUNT=2
PING_DEADLINE=5
MAX_TARGETS=3
# Ethernet is reconnected at most this often while it keeps failing
RESET_EVERY=600
# While on WiFi with an ethernet link, going back is tried this often
RETRY_EVERY=300

TARGETS=(1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 9.9.9.9)

# For testing: DRY_RUN logs privileged commands instead of running them, the FAKE ones pretend links are up or down
DRY_RUN=${WIFI_CHECK_DRY_RUN:-0}
FAKE_ETH_DOWN=${WIFI_CHECK_FAKE_ETH_DOWN:-0}
FAKE_ROUTER_DOWN=${WIFI_CHECK_FAKE_ROUTER_DOWN:-0}
FAKE_WIFI_UP=${WIFI_CHECK_FAKE_WIFI_UP:-0}

log() {
	printf '%s - %s\n' "$(date +'%m-%d %r')" "$1" >> "$LOG_PATH"
	[ "$DRY_RUN" = "1" ] && printf '%s\n' "$1"
	return 0
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

# Passwordless sudo for the few commands the sudoers rule allows, never a prompt
privileged() {
	if [ "$DRY_RUN" = "1" ]; then
		printf 'would run: %s\n' "$*"
		return 0
	fi
	sudo -n "$@" >/dev/null 2>&1
}

read_file() {
	[ -f "$1" ] && cat "$1" 2>/dev/null
}

# Stops at the first target that replies, so one dead resolver is not an outage
reaches_internet() {
	local iface=$1 target tried=0
	[ "$iface" = "$ETH" ] && [ "$FAKE_ETH_DOWN" = "1" ] && return 1
	[ "$iface" = "$WIFI" ] && [ "$FAKE_WIFI_UP" = "1" ] && return 0
	while read -r target; do
		tried=$((tried + 1))
		[ "$tried" -gt "$MAX_TARGETS" ] && break
		if ping -c "$PING_COUNT" -w "$PING_DEADLINE" -I "$iface" "$target" >/dev/null 2>&1; then
			return 0
		fi
	done < <(shuf -e "${TARGETS[@]}")
	return 1
}

# The router answering over ethernet means the fault is past it, and WiFi goes through the same router
reaches_router() {
	[ "$FAKE_ROUTER_DOWN" = "1" ] && return 1
	local gateway
	gateway=$(ip -4 route show default dev "$ETH" 2>/dev/null | awk '{print $3; exit}')
	[ -z "$gateway" ] && return 1
	ping -c "$PING_COUNT" -w "$PING_DEADLINE" -I "$ETH" "$gateway" >/dev/null 2>&1
}

eth_has_link() {
	[ "$(cat "/sys/class/net/$ETH/carrier" 2>/dev/null)" = "1" ]
}

wifi_connected() {
	[ "$FAKE_WIFI_UP" = "1" ] && return 0
	[ "$(nmcli -g GENERAL.STATE device show "$WIFI" 2>/dev/null | cut -d' ' -f1)" = "100" ]
}

# Logs only when the state changes, so a long outage is one line
record_state() {
	local state=$1 detail=$2
	[ "$(read_file "$STATE_PATH")" = "$state" ] && return 1
	printf '%s' "$state" > "$STATE_PATH"
	log "$detail"
	return 0
}

# True when at least `every` seconds have passed since the stamp in `file`, which it then renews
due() {
	local file=$1 every=$2 now last
	now=$(date +%s)
	last=$(read_file "$file")
	[ -n "$last" ] && [ $((now - last)) -lt "$every" ] && return 1
	printf '%s' "$now" > "$file"
	return 0
}

wifi_up() {
	privileged nmcli connection up uuid "$WIFI_CONNECTION"
}

wifi_down() {
	privileged nmcli connection down uuid "$WIFI_CONNECTION"
}

# Back to ethernet, WiFi goes down first so 192.168.1.125 is never on both
to_ethernet() {
	wifi_down
	privileged nmcli device connect "$ETH"
	printf 'ethernet' > "$UPLINK_PATH"
}

to_wifi() {
	privileged nmcli device disconnect "$ETH"
	if wifi_up; then
		printf 'wifi' > "$UPLINK_PATH"
		return 0
	fi
	privileged nmcli device connect "$ETH"
	return 1
}

on_ethernet() {
	if reaches_internet "$ETH"; then
		# WiFi up next to working ethernet would put 192.168.1.125 on the network twice
		if wifi_connected && [ "$FAKE_WIFI_UP" != "1" ]; then
			wifi_down
			log "WiFi was up alongside ethernet, took it down so 192.168.1.125 is only on $ETH"
		fi
		record_state up "Network is up on $ETH"
		return 0
	fi

	if reaches_router; then
		record_state upstream "No internet, but the router answers on $ETH, so the problem is past the router"
		return 1
	fi

	if due "$RESET_PATH" "$RESET_EVERY"; then
		if privileged nmcli device connect "$ETH"; then
			log "$ETH cannot reach the router, reconnected it"
		else
			log "Could not reconnect $ETH, the sudoers rule may be missing"
		fi
		sleep 10
		if reaches_internet "$ETH"; then
			record_state up "Network is up on $ETH after a reconnect"
			return 0
		fi
	fi

	if to_wifi; then
		sleep 15
		if reaches_internet "$WIFI"; then
			record_state wifi "$ETH cannot reach the router, moved 192.168.1.125 to WiFi"
			return 0
		fi
		to_ethernet
	fi
	record_state down "No internet on $ETH, and WiFi did not help"
	return 1
}

on_wifi() {
	# WiFi failing as well means staying on it helps nothing, so ethernet always comes back
	if ! reaches_internet "$WIFI"; then
		to_ethernet
		record_state down "WiFi lost the internet too, back on $ETH"
		return 1
	fi

	if ! eth_has_link || ! due "$RETRY_PATH" "$RETRY_EVERY"; then
		record_state wifi "Running on WiFi, $ETH is still not usable"
		return 0
	fi

	to_ethernet
	sleep 15
	if reaches_internet "$ETH"; then
		record_state up "Ethernet works again, moved 192.168.1.125 back from WiFi"
		return 0
	fi
	to_wifi
	log "Tried ethernet again, it still has no internet, staying on WiFi"
	return 0
}

main() {
	rotate_log
	if [ "$(read_file "$UPLINK_PATH")" = "wifi" ]; then
		on_wifi
	else
		on_ethernet
	fi
}

exec 9>"$LOCK_PATH"
flock -n 9 || exit 0

main
