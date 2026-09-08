#!/bin/bash

# Installs the hourly cron entry that runs the pm2 log cleaner.
# Safe to re-run, and replaces any older entry pointing at this script.
# Pass --remove to uninstall.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/index.js"
SCHEDULE="0 * * * *"

# Any prior entry is matched on this rather than the full line, so a moved
# repo or a different node path still gets replaced instead of duplicated
MARKER="log-cleaner/index.js"

if [ ! -f "$SCRIPT" ]; then
	echo "Could not find $SCRIPT" >&2
	exit 1
fi

CURRENT="$(crontab -l 2>/dev/null || true)"
KEPT="$(printf '%s\n' "$CURRENT" | grep -vF "$MARKER" || true)"

if [ "$1" = "--remove" ]; then
	if [ -n "$KEPT" ]; then
		printf '%s\n' "$KEPT" | crontab -
	else
		crontab -r 2>/dev/null || true
	fi

	echo "Removed the log cleaner cron entry."
	exit 0
fi

# Prefer the pinned symlink the other cron jobs use, since cron gets a bare
# PATH that will not include a version manager's node
NODE="$HOME/.local/bin/node-current"

if [ ! -x "$NODE" ]; then
	NODE="$(command -v node || true)"
fi

if [ -z "$NODE" ]; then
	echo "No node binary found. Install node, or symlink one to $HOME/.local/bin/node-current" >&2
	exit 1
fi

ENTRY="$SCHEDULE $NODE $SCRIPT > /dev/null 2>&1"

if [ -n "$KEPT" ]; then
	printf '%s\n%s\n' "$KEPT" "$ENTRY" | crontab -
else
	printf '%s\n' "$ENTRY" | crontab -
fi

echo "Installed: $ENTRY"
