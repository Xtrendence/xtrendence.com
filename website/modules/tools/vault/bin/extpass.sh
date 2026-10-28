#!/bin/sh
# gocryptfs -passwd asks this for the current password first, then the new one, see api/vault.ts
if [ -e "$VAULT_STEP" ]; then
	printf '%s\n' "$VAULT_NEW"
else
	: >"$VAULT_STEP"
	printf '%s\n' "$VAULT_OLD"
fi
