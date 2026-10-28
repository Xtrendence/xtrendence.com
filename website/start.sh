# On a hardened server (see ~/Documents/harden.sh) every app runs under the apps user's pm2, from /srv/website,
# started from its entry in ecosystem.apps.json. Builds still run here as the owner
if command -v apps-pm2 >/dev/null && mountpoint -q /srv/website; then
	PM2=apps-pm2
else
	PM2=pm2
fi

start_app() {
	local name="$1"
	shift
	if [ "$PM2" = apps-pm2 ]; then
		apps-pm2 start /srv/website/ecosystem.apps.json --only "$name"
	else
		pm2 start "$@"
	fi
}

$PM2 stop xtrendence.com; 
$PM2 stop auth; 
$PM2 stop bot; 
$PM2 stop lights;
$PM2 stop plutus;
$PM2 stop journey;
$PM2 stop smahunter;
$PM2 stop cyberchef;
$PM2 stop beacon;

$PM2 delete xtrendence.com; 
$PM2 delete auth; 
$PM2 delete bot; 
$PM2 delete lights;
$PM2 delete plutus;
$PM2 delete journey;
$PM2 delete smahunter;
$PM2 delete cyberchef;
$PM2 delete beacon;

cd ~/Documents/website && start_app "xtrendence.com" npm --name "xtrendence.com" -- run prod;
# NOTE: start tsx DIRECTLY via its JS entry (node_modules/tsx/dist/cli.mjs), NOT via
# `bun/pnpm run api` and NOT via node_modules/.bin/tsx. Two Node 22 gotchas:
#   1) Running tsx through a pnpm/bun wrapper under PM2 breaks tsx's dynamic-import
#      loader -> every import() throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING (the app
#      shows "online" in pm2 but the server never boots).
#   2) pnpm's node_modules/.bin/tsx is a SHELL shim, so `pm2 start .bin/tsx` makes node
#      parse a shell script -> "SyntaxError: missing ) after argument list".
# Pointing PM2 at the real cli.mjs avoids both, regardless of package manager.
cd ~/Documents/website/modules/tools/lights && bun run build && start_app "lights" ./node_modules/tsx/dist/cli.mjs --name "lights" -- api/server.ts;
cd ~/Documents/website/modules/tools/plutus && pnpm run build && start_app "plutus" ./node_modules/tsx/dist/cli.mjs --name "plutus" -- api/server.ts;
cd ~/Documents/website/modules/tools/journey && bun run build && start_app "journey" ./node_modules/tsx/dist/cli.mjs --name "journey" -- api/server.ts;
cd ~/Documents/website/modules/tools/smahunter && pnpm run build && start_app "smahunter" ./node_modules/tsx/dist/cli.mjs --name "smahunter" -- src/backend/app.ts;
cd ~/Documents/website/modules/tools/beacon && pnpm run build && start_app "beacon" ./node_modules/tsx/dist/cli.mjs --name "beacon" -- api/server.ts;
# CyberChef is a static bundle, so the build is the slow part and the host is just a
# file server. The build needs Node 24, which is why it is pinned here rather than
# inheriting whatever nvm currently defaults to.
cd ~/Documents/website/modules/tools/cyberchef && . ~/.nvm/nvm.sh && nvm exec 24 npm run build && start_app "cyberchef" server/server.mjs --name "cyberchef";
cd ~/Documents/website/modules/auth && start_app "auth" npm --name "auth" -- run start;
cd ~/Documents/website/modules/bot && start_app "bot" npm --name "bot" -- run start;

$PM2 save;

# The vault runs as the vault user under its own pm2, which only exists on a hardened server
if command -v vault-pm2 >/dev/null && mountpoint -q /srv/website; then
	vault-pm2 delete vault;
	cd ~/Documents/website/modules/tools/vault && pnpm run build && vault-pm2 start /srv/website/ecosystem.vault.json && vault-pm2 save;
fi
