#!/bin/bash
# Moves this server to the hardened layout. Safe to run again at any time, and meant to be run after restore.sh
#  - Every web app runs as the unprivileged apps user, from /srv/website, a bind mount of the website folder
#  - The website's privileged work runs as the owner in xtrendence-agent.service, with root only through a fixed helper
#  - Drives mounted for the vault user (umask=077 in fstab) follow its uid
#  - Samba from website/hardening/smb.conf, with Docker networks kept away from it, and ufw allowing only the LAN and VPN
#  - The encrypted vault service on port 7900 runs as vault under its own pm2, see website/modules/tools/vault
# The system files it installs live in website/hardening. restore.sh runs it as its last step
# Usage: sudo bash ~/Documents/harden.sh
# OTHER_APPS can point at a backup's system/pm2/other-apps.json, pm2 apps outside ecosystem.apps.json to bring back
# VAULT_STATE can point at a backup's system/vault, the vault service's keys and import hours, so browsers that pinned its key keep trusting it
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
	echo "Run it with sudo: sudo bash $0"
	exit 1
fi

OWNER="${SUDO_USER:-}"
if [ -z "$OWNER" ] || [ "$OWNER" = root ]; then
	echo "Run it with sudo from the owner's account, so it knows whose website this is"
	exit 1
fi
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"
WEBSITE="$OWNER_HOME/Documents/website"
TEMPLATES="$WEBSITE/hardening"
SRV=/srv/website
APPS_HOME=/var/lib/apps
VAULT_HOME=/var/lib/vault
# The vault drive, holding the encrypted vault, the sealed uploads waiting for it and FolderSync's inbox
VAULT_DRIVE=/media/Seagate
VAULT_MOUNT=/srv/vault
NODE_VERSION="${NODE_VERSION:-v22.23.4}"
NVM_NODE="$OWNER_HOME/.nvm/versions/node/$NODE_VERSION"
KASA_VERSION="${KASA_VERSION:-0.6.2.1}"
# Must match TAPO_VERSION in website/modules/tools/lights/api/plugs.ts
TAPO_VERSION="0.11.1"
# The home network, the same one smb.conf allows
LAN_SUBNET="${LAN_SUBNET:-192.168.1.0/24}"
# VPN clients arrive from wg-easy's network (pinned in its compose file) or directly from the WireGuard subnet
VPN_SUBNETS=(172.18.0.0/16 10.8.0.0/24)
OTHER_APPS="${OTHER_APPS:-}"
VAULT_STATE="${VAULT_STATE:-}"
# Holds the owner's pm2 list while it is read, it has every app's environment in it
OWNER_LIST=/run/harden-owner-pm2.json

# Folders the web apps write, relative to the website. Everything else stays read only to them
APP_DATA=(
	certs
	state
	modules/auth/db
	modules/bot/data
	modules/tools/journey/api/data
	modules/tools/plutus/api/data
	modules/tools/smahunter/fundamentals
	modules/tools/smahunter/historical
	modules/tools/smahunter/results
	modules/tools/smahunter/live
	modules/tools/smahunter/logs
	modules/tools/smahunter/settings
	modules/tools/smahunter/list
)
# Lights keeps its data files beside its code, so that folder is shared differently, see Permissions
LIGHTS_API="$WEBSITE/modules/tools/lights/api"
LIGHTS_DATA=(energy.db energy.db-wal energy.db-shm actions.log alerts.txt climate.txt keys.txt lights.txt plugs.txt plugs-state.json)

step() { printf '\n== %s\n' "$1"; }
as_owner() { runuser -u "$OWNER" -- "$@"; }
in_group() { id -nG "$1" | tr ' ' '\n' | grep -qx "$2"; }
render() { sed -e "s#@OWNER@#$OWNER#g" -e "s#@HOME@#$OWNER_HOME#g" -e "s#@NODE@#$NODE_VERSION#g" "$TEMPLATES/$1"; }
owner_pm2() { as_owner env HOME="$OWNER_HOME" PATH="$NVM_NODE/bin:/usr/bin:/bin" "$NVM_NODE/bin/pm2" "$@"; }

# apps owns it, the owner shares it through the apps group, and new files keep that group. node_modules is left alone
give_to_apps() {
	find "$1" -path '*/node_modules' -prune -o -exec chown apps:apps {} +
	find "$1" -path '*/node_modules' -prune -o -exec chmod g+rwX,o-rwx {} +
	find "$1" -path '*/node_modules' -prune -o -type d -exec chmod g+s {} +
}

if [ ! -d "$WEBSITE" ] || [ ! -d "$TEMPLATES" ]; then
	echo "No website with a hardening folder at $WEBSITE"
	exit 1
fi
case "$WEBSITE" in
	*[[:space:]]*)
		echo "The website path has a space, which the fstab bind line cannot hold"
		exit 1
		;;
esac

step "Packages"
needed=()
for package in samba ufw python3-venv smartmontools gocryptfs age acl; do
	dpkg -s "$package" >/dev/null 2>&1 || needed+=("$package")
done
if [ ${#needed[@]} -gt 0 ]; then
	# A fresh install may have stale package lists
	DEBIAN_FRONTEND=noninteractive apt-get install -y "${needed[@]}" >/dev/null 2>&1 \
		|| { apt-get update >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y "${needed[@]}" >/dev/null; }
	echo "Installed ${needed[*]}"
else
	echo "All present"
fi

step "Users"
id vault >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin --user-group vault
id apps >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APPS_HOME" --shell /usr/sbin/nologin --user-group apps
chmod 750 "$APPS_HOME"
in_group "$OWNER" apps || usermod -aG apps "$OWNER"
# Raw disk access would let any of the owner's processes read every drive, the vault's included
if in_group "$OWNER" disk; then
	gpasswd -d "$OWNER" disk >/dev/null
fi
echo "vault and apps exist, $OWNER is in apps and not in disk"

step "Vault drives"
python3 - "$(id -u vault)" "$(id -g vault)" <<'EOF'
import sys

uid, gid = sys.argv[1], sys.argv[2]
path = "/etc/fstab"
lines = open(path).read().split("\n")
changed = 0
for index, line in enumerate(lines):
    fields = line.split()
    if len(fields) < 4 or line.lstrip().startswith("#"):
        continue
    options = fields[3].split(",")
    if "umask=077" not in options:
        continue
    wanted = [f"uid={uid}" if o.startswith("uid=") else f"gid={gid}" if o.startswith("gid=") else o for o in options]
    if not any(o.startswith("uid=") for o in wanted):
        wanted.append(f"uid={uid}")
    if not any(o.startswith("gid=") for o in wanted):
        wanted.append(f"gid={gid}")
    if wanted != options:
        fields[3] = ",".join(wanted)
        lines[index] = "\t".join(fields)
        changed += 1
if changed:
    open(path, "w").write("\n".join(lines))
    print(f"{changed} vault drive lines now use vault's uid, remount them or reboot")
else:
    print("Vault drive lines already use vault's uid")
EOF

step "Node for apps"
if [ ! -x "/opt/node/$NODE_VERSION/bin/node" ]; then
	if [ ! -x "$NVM_NODE/bin/node" ]; then
		echo "Node $NODE_VERSION is not installed with nvm for $OWNER, install it or set NODE_VERSION"
		exit 1
	fi
	mkdir -p /opt/node
	cp -a "$NVM_NODE" /opt/node/
	chown -R root:root "/opt/node/$NODE_VERSION"
fi
ln -sfn "$NODE_VERSION" /opt/node/current
# The website listens on ports 80 and 443
setcap cap_net_bind_service=+ep "/opt/node/$NODE_VERSION/bin/node"
echo "/opt/node/current is $(/opt/node/current/bin/node -v), owned by root"

step "kasa for the lights tool"
if [ ! -x /opt/kasa/bin/kasa ]; then
	python3 -c 'import ensurepip' 2>/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv >/dev/null
	python3 -m venv /opt/kasa
	/opt/kasa/bin/pip install --quiet --disable-pip-version-check "python-kasa==$KASA_VERSION"
fi
ln -sfn /opt/kasa/bin/kasa /usr/local/bin/kasa
echo "$(/usr/local/bin/kasa --version 2>&1 | tail -1)"

step "uv for the lights tool's plugs"
# plugs.ts runs plug.py through uv, which lives in the owner's home where apps cannot reach it
OWNER_UV="$OWNER_HOME/.local/bin/uv"
if [ -x "$OWNER_UV" ]; then
	install -m 0755 -o root -g root "$OWNER_UV" /usr/local/bin/uv
elif [ ! -x /usr/local/bin/uv ]; then
	echo "No uv in $OWNER_UV to copy, the plugs will not work until /usr/local/bin/uv exists"
fi
if [ -x /usr/local/bin/uv ]; then
	# Python and tapo land in apps' own cache now, so the first plug command does not spend its timeout downloading
	sudo -u apps env HOME=/var/lib/apps /usr/local/bin/uv run --quiet --no-project --python 3.12 --with "tapo==$TAPO_VERSION" python -c 'import tapo' \
		&& echo "$(/usr/local/bin/uv --version), with Python 3.12 and tapo $TAPO_VERSION cached for apps" \
		|| echo "uv could not prepare Python 3.12 and tapo for apps, check the network"
fi

step "Helper, sudoers and the agent's socket folder"
install -m 0755 -o root -g root "$TEMPLATES/xtrendence-helper" /usr/local/sbin/xtrendence-helper
install -m 0755 -o root -g root "$TEMPLATES/apps-pm2" /usr/local/bin/apps-pm2
install -m 0755 -o root -g root "$TEMPLATES/vault-pm2" /usr/local/bin/vault-pm2
# Put first on PATH by the agent for the plutus and smahunter upgrades, whose build scripts call pm2
mkdir -p /usr/local/lib/apps-pm2
ln -sfn /usr/local/bin/apps-pm2 /usr/local/lib/apps-pm2/pm2
# sudo skips files with a dot in their name, so the new rules are checked before they replace the old ones
render sudoers >/etc/sudoers.d/xtrendence-helper.new
chmod 0440 /etc/sudoers.d/xtrendence-helper.new
visudo -cqf /etc/sudoers.d/xtrendence-helper.new
mv /etc/sudoers.d/xtrendence-helper.new /etc/sudoers.d/xtrendence-helper
render tmpfiles.conf >/etc/tmpfiles.d/xtrendence-agent.conf
systemd-tmpfiles --create /etc/tmpfiles.d/xtrendence-agent.conf
render xtrendence-agent.service >/etc/systemd/system/xtrendence-agent.service
systemctl daemon-reload
echo "Installed"

step "Website folder for apps"
mkdir -p "$SRV"
if ! grep -qE "^[^#[:space:]]+[[:space:]]+$SRV[[:space:]]" /etc/fstab; then
	printf '%s %s none bind,nofail 0 0\n' "$WEBSITE" "$SRV" >>/etc/fstab
	systemctl daemon-reload
fi
mountpoint -q "$SRV" || mount "$SRV"
echo "$SRV is mounted"

step "Permissions"
# The agent's state, which the web process must neither read nor change
chown -R "$OWNER:$OWNER" "$WEBSITE/data"
chmod -R go-rwx "$WEBSITE/data"
# Secrets the apps need, readable by them and the owner only
find "$WEBSITE" -path '*/node_modules' -prune -o -type f \( -name .env -o -name firebase.json \) -exec chgrp apps {} + -exec chmod 640 {} +
for relative in "${APP_DATA[@]}"; do
	[ -d "$(dirname "$WEBSITE/$relative")" ] || continue
	as_owner mkdir -p "$WEBSITE/$relative"
	give_to_apps "$WEBSITE/$relative"
done
# At the website root, so the file is the web process's but the folder is not
[ -f "$WEBSITE/visitors.txt" ] || as_owner touch "$WEBSITE/visitors.txt"
chown apps:apps "$WEBSITE/visitors.txt"
chmod 660 "$WEBSITE/visitors.txt"
# Share codes moved from data, the agent's folder, to state
if [ -f "$WEBSITE/data/server-share.json" ] && [ ! -f "$WEBSITE/state/server-share.json" ]; then
	cp "$WEBSITE/data/server-share.json" "$WEBSITE/state/server-share.json"
	chown apps:apps "$WEBSITE/state/server-share.json"
	chmod 640 "$WEBSITE/state/server-share.json"
fi
if [ -d "$LIGHTS_API" ]; then
	# Group writable so lights can create its database journals, sticky so it cannot replace the code files beside them
	chgrp apps "$LIGHTS_API"
	chmod 3775 "$LIGHTS_API"
	for name in "${LIGHTS_DATA[@]}"; do
		[ -e "$LIGHTS_API/$name" ] || continue
		chown apps:apps "$LIGHTS_API/$name"
		chmod 660 "$LIGHTS_API/$name"
	done
fi
echo "Data folders belong to apps, the agent's data is the owner's alone"

step "Samba"
render smb.conf >/etc/samba/smb.conf.new
if ! testparm -s /etc/samba/smb.conf.new >/dev/null 2>&1; then
	echo "website/hardening/smb.conf does not pass testparm, fix it and run this again"
	exit 1
fi
if cmp -s /etc/samba/smb.conf.new /etc/samba/smb.conf; then
	rm -f /etc/samba/smb.conf.new
	echo "smb.conf already matches website/hardening/smb.conf"
else
	# The replaced config is kept, in case it had changes the template does not
	[ -f /etc/samba/smb.conf ] && cp /etc/samba/smb.conf "/etc/samba/smb.conf.before-harden-$(date +%Y%m%d-%H%M%S)"
	mv /etc/samba/smb.conf.new /etc/samba/smb.conf
	systemctl restart smbd nmbd
	echo "Installed website/hardening/smb.conf, the old one is kept beside it"
fi
# Docker's default bridge shares the LAN's IPv6 prefix, so smb.conf cannot keep containers out over IPv6
render samba-docker-block.service >/etc/systemd/system/samba-docker-block.service
systemctl daemon-reload
systemctl enable samba-docker-block >/dev/null 2>&1
systemctl restart samba-docker-block
# A fresh install has no Samba login yet, so it is asked for once
samba_user="$(grep -m1 -E '^[[:space:]]*valid users[[:space:]]*=' /etc/samba/smb.conf | sed -E 's/^[^=]*=[[:space:]]*//; s/[[:space:],].*//')"
if [ -n "$samba_user" ] && ! pdbedit -L 2>/dev/null | cut -d: -f1 | grep -qix "$samba_user"; then
	if [ -t 0 ]; then
		echo "Set the Samba password for $samba_user, normally the same as the login password"
		smbpasswd -a "$samba_user"
	else
		echo "No Samba login for $samba_user yet, add one with: sudo smbpasswd -a $samba_user"
	fi
fi
echo "Samba is $(systemctl is-active smbd), Docker networks are blocked from it"

step "Firewall"
# Docker publishes its ports past ufw, so this covers what runs on the host itself: SSH, the website, Samba,
# AFP, remote desktop, the tool ports and PostgreSQL. Only the LAN and VPN clients get in, Docker containers do not
# Rebuilt from scratch every run so these are the only rules, ufw keeps a timestamped copy of the old ones
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow from "$LAN_SUBNET" comment "LAN" >/dev/null
for subnet in "${VPN_SUBNETS[@]}"; do
	ufw allow from "$subnet" comment "VPN clients" >/dev/null
done
# The ISP changes the IPv6 prefix, so IPv6 is allowed by interface and the router keeps the internet out
for interface in $(ls /sys/class/net | grep -E '^(en|eth|wl)'); do
	ufw allow in on "$interface" from ::/0 comment "LAN IPv6" >/dev/null
done
ufw allow 51820/udp comment "WireGuard" >/dev/null
ufw --force enable >/dev/null
echo "ufw is $(ufw status | head -1 | awk '{print $2}'), letting in $LAN_SUBNET, VPN clients and IPv6 on the LAN interfaces"

step "Server password"
# The VPN QR code check keeps only a hash in data. The password itself must not stay where the web process can read it
if grep -q '^SERVER_PASSWORD=' "$WEBSITE/.env" 2>/dev/null; then
	if [ ! -f "$WEBSITE/data/server-password.json" ]; then
		(cd "$WEBSITE" && as_owner /opt/node/current/bin/node --input-type=module -e '
			import fs from "node:fs";
			import { randomBytes, scryptSync } from "node:crypto";
			import dotenv from "dotenv";
			const env = dotenv.parse(fs.readFileSync(".env"));
			const password = Buffer.from(env.SERVER_PASSWORD ?? "", "base64").toString("utf-8");
			if (!password) process.exit(0);
			const salt = randomBytes(16);
			const params = { N: 16384, r: 8, p: 1 };
			const hash = scryptSync(password, salt, 32, params);
			fs.writeFileSync("data/server-password.json", JSON.stringify({ salt: salt.toString("hex"), hash: hash.toString("hex"), ...params }, null, 4), { mode: 0o600 });
		')
	fi
	as_owner sed -i '/^SERVER_PASSWORD=/d' "$WEBSITE/.env"
	echo "Removed SERVER_PASSWORD from website/.env, the agent keeps a hash of it"
else
	echo "website/.env has no SERVER_PASSWORD"
fi

step "pm2 for apps"
if [ ! -f /etc/systemd/system/pm2-apps.service ]; then
	env PATH="/opt/node/current/bin:$PATH" /opt/node/current/bin/pm2 startup systemd -u apps --hp "$APPS_HOME" >/dev/null
fi
mkdir -p /etc/systemd/system/pm2-apps.service.d
cat >/etc/systemd/system/pm2-apps.service.d/umask.conf <<'EOF'
# Files the apps write stay readable by the owner through the apps group, which backups need
[Service]
UMask=0007
EOF
systemctl daemon-reload
systemctl enable pm2-apps >/dev/null 2>&1
if ! systemctl is-active --quiet pm2-apps; then
	apps-pm2 kill >/dev/null 2>&1 || true
	systemctl start pm2-apps
fi
echo "pm2-apps is $(systemctl is-active pm2-apps)"

step "Moving the apps"
# Only the apps in ecosystem.apps.json move to apps. Anything else, like OSINT, stays with the owner's pm2
if [ -x "$NVM_NODE/bin/pm2" ] && pgrep -u "$OWNER" -f 'PM2 v[0-9.]+: God Daemon' >/dev/null; then
	install -m 0600 /dev/null "$OWNER_LIST"
	owner_pm2 jlist 2>/dev/null | sed -n '/^\[/,$p' >"$OWNER_LIST"
	read -r MOVED KEPT < <(python3 - "$OWNER_LIST" "$WEBSITE/ecosystem.apps.json" <<'EOF'
import json, sys

listed, ecosystem = sys.argv[1:3]
known = {app["name"] for app in json.load(open(ecosystem))["apps"]}
names = [process["name"] for process in json.loads(open(listed).read() or "[]")]
moved = [name for name in names if name in known]
print(",".join(moved) or "-", len(names) - len(moved))
EOF
)
	: >"$OWNER_LIST"

	IFS=, read -r -a names <<<"$MOVED"
	for name in "${names[@]}"; do
		[ "$name" = "-" ] || owner_pm2 delete "$name" >/dev/null 2>&1 || true
	done
	if [ "$KEPT" -eq 0 ]; then
		# Nothing is left for the owner's pm2. Its dump and the .bak pm2 falls back to are set aside, since
		# resurrecting either at boot would start every app twice
		for dump in dump.pm2 dump.pm2.bak; do
			if [ -f "$OWNER_HOME/.pm2/$dump" ]; then
				mv "$OWNER_HOME/.pm2/$dump" "$OWNER_HOME/.pm2/$dump.before-harden"
			fi
		done
		systemctl disable --now "pm2-$OWNER" >/dev/null 2>&1 || true
		owner_pm2 kill >/dev/null 2>&1 || true
	else
		# Saved twice so the .bak pm2 falls back to holds the same short list
		owner_pm2 save >/dev/null 2>&1 || true
		owner_pm2 save >/dev/null 2>&1 || true
		echo "$KEPT apps outside ecosystem.apps.json stay with $OWNER's pm2"
	fi
fi

if [ "$(apps-pm2 jlist | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" -eq 0 ]; then
	apps-pm2 start "$SRV/ecosystem.apps.json" >/dev/null
	apps-pm2 save >/dev/null
fi
echo "apps' pm2 has $(apps-pm2 jlist | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))') apps"

# pm2 apps outside ecosystem.apps.json, like OSINT, from a backup. Any already running are left alone
if [ -n "$OTHER_APPS" ] && [ -s "$OTHER_APPS" ]; then
	step "Other apps from the backup"
	install -m 600 -o apps -g apps "$OTHER_APPS" "$APPS_HOME/other-apps.json"
	while IFS=$'\t' read -r name dir stopped; do
		# Their folders become the apps user's, never a whole drive or a top level folder
		if [ -d "$dir" ] && ! mountpoint -q "$dir" && [ "$(printf '%s' "$dir" | tr -cd / | wc -c)" -ge 3 ]; then
			give_to_apps "$dir"
			# Vite writes its config bundle inside node_modules when it starts
			while IFS= read -r modules; do
				mkdir -p "$modules/.vite-temp" "$modules/.vite"
				chown -R apps:apps "$modules/.vite-temp" "$modules/.vite"
			done < <(find "$dir" -maxdepth 4 -type d -name node_modules -prune)
		fi
		apps-pm2 start "$APPS_HOME/other-apps.json" --only "$name" >/dev/null
		# Stopped at backup time, so stopped again here
		[ "$stopped" = "yes" ] && apps-pm2 stop "$name" >/dev/null
		echo "$name is back$([ "$stopped" = "yes" ] && echo ", stopped as it was")"
	done < <(apps-pm2 jlist | python3 -c '
import json, sys
running = {app["name"] for app in json.load(sys.stdin)}
for app in json.load(open(sys.argv[1]))["apps"]:
    if app["name"] not in running:
        print(app["name"], app["cwd"], "yes" if app.get("stopped") else "no", sep="\t")
' "$APPS_HOME/other-apps.json")
	apps-pm2 save >/dev/null
fi

step "Vault"
# vault holds no key, the vault password only ever reaches gocryptfs. Its home keeps the service's own key and pm2
[ "$(getent passwd vault | cut -d: -f6)" = "$VAULT_HOME" ] || usermod -d "$VAULT_HOME" vault
install -d -o vault -g vault -m 700 "$VAULT_HOME"
if [ -n "$VAULT_STATE" ] && [ -d "$VAULT_STATE" ]; then
	for name in server-key.json age.pub schedule.json; do
		if [ -f "$VAULT_STATE/$name" ] && [ ! -f "$VAULT_HOME/$name" ]; then
			install -m 600 -o vault -g vault "$VAULT_STATE/$name" "$VAULT_HOME/$name"
			echo "Brought back the vault service's $name"
		fi
	done
fi
# The Samba share reaches the open vault through allow_other, gocryptfs still checks vault's own permissions
if ! grep -qx 'user_allow_other' /etc/fuse.conf; then
	sed -i 's/^#[[:space:]]*user_allow_other[[:space:]]*$/user_allow_other/' /etc/fuse.conf
	grep -qx 'user_allow_other' /etc/fuse.conf || echo user_allow_other >>/etc/fuse.conf
fi
mountpoint -q "$VAULT_MOUNT" || install -d -o vault -g vault -m 700 "$VAULT_MOUNT"
if mountpoint -q "$VAULT_DRIVE"; then
	runuser -u vault -- mkdir -p "$VAULT_DRIVE/Vault/cipher" "$VAULT_DRIVE/Vault/pending" "$VAULT_DRIVE/Inbox"
else
	echo "$VAULT_DRIVE is not mounted, its vault folders are made once it is and this runs again"
fi
if [ ! -f /etc/systemd/system/pm2-vault.service ]; then
	env PATH="/opt/node/current/bin:$PATH" /opt/node/current/bin/pm2 startup systemd -u vault --hp "$VAULT_HOME" >/dev/null
fi
mkdir -p /etc/systemd/system/pm2-vault.service.d
cat >/etc/systemd/system/pm2-vault.service.d/umask.conf <<'EOF'
# Nothing the vault service writes is for anyone else
[Service]
UMask=0077
EOF
systemctl daemon-reload
systemctl enable pm2-vault >/dev/null 2>&1
systemctl is-active --quiet pm2-vault || systemctl start pm2-vault
if [ ! -d "$WEBSITE/modules/tools/vault/node_modules" ]; then
	echo "The vault module has no packages yet, run pnpm install in website/modules/tools/vault and this again"
elif [ "$(vault-pm2 jlist | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" -eq 0 ]; then
	vault-pm2 start "$SRV/ecosystem.vault.json" >/dev/null
	vault-pm2 save >/dev/null
fi
# The agent watches every pm2 log for crash loops, this lets the owner read the vault's and nothing else in its home
setfacl -m "u:$OWNER:x" "$VAULT_HOME"
if [ -d "$VAULT_HOME/.pm2" ]; then
	setfacl -m "u:$OWNER:x" "$VAULT_HOME/.pm2"
	if [ -f "$VAULT_HOME/.pm2/pm2.log" ]; then
		setfacl -m "u:$OWNER:r" "$VAULT_HOME/.pm2/pm2.log"
	fi
fi
echo "pm2-vault is $(systemctl is-active pm2-vault), the vault service listens on port 7900 for the LAN and VPN"

step "Agent"
systemctl enable xtrendence-agent >/dev/null 2>&1
systemctl restart xtrendence-agent
echo "xtrendence-agent is $(systemctl is-active xtrendence-agent)"

step "Shell"
ZSHRC="$OWNER_HOME/.zshrc"
if [ -f "$ZSHRC" ] && ! grep -q 'alias pm2=apps-pm2' "$ZSHRC"; then
	printf '\n# Every web app runs under the apps user'"'"'s pm2, see ~/Documents/harden.sh\nalias pm2=apps-pm2\n' >>"$ZSHRC"
	echo "pm2 in zsh now means apps-pm2"
fi

step "Done"
echo "Log out and back in, or reboot, so $OWNER's sessions pick up the apps group"
