cd ~/Documents/tools/dns-updater && npm install --force;
cd ~/Documents/tools/stake-check && npm install --force;

cd ~/Documents/website/ && npm install --force;
cd ~/Documents/website/modules/tools/lights && bun install --force && bun run build;
cd ~/Documents/website/modules/tools/plutus && pnpm install --force && pnpm run build;
cd ~/Documents/website/modules/tools/journey && bun install --force && bun run build;
cd ~/Documents/website/modules/auth && npm install --force;
cd ~/Documents/website/modules/bot && npm install --force;