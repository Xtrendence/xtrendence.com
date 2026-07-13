pm2 stop xtrendence.com; 
pm2 stop auth; 
pm2 stop bot; 
pm2 stop lights;
pm2 stop plutus;
pm2 stop journey;
pm2 stop smahunter;

pm2 delete xtrendence.com; 
pm2 delete auth; 
pm2 delete bot; 
pm2 delete lights;
pm2 delete plutus;
pm2 delete journey;
pm2 delete smahunter;

cd ~/Documents/website && pm2 start npm --name "xtrendence.com" -- run prod;
# NOTE: start tsx DIRECTLY via its JS entry (node_modules/tsx/dist/cli.mjs), NOT via
# `bun/pnpm run api` and NOT via node_modules/.bin/tsx. Two Node 22 gotchas:
#   1) Running tsx through a pnpm/bun wrapper under PM2 breaks tsx's dynamic-import
#      loader -> every import() throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING (the app
#      shows "online" in pm2 but the server never boots).
#   2) pnpm's node_modules/.bin/tsx is a SHELL shim, so `pm2 start .bin/tsx` makes node
#      parse a shell script -> "SyntaxError: missing ) after argument list".
# Pointing PM2 at the real cli.mjs avoids both, regardless of package manager.
cd ~/Documents/website/modules/tools/lights && bun run build && pm2 start ./node_modules/tsx/dist/cli.mjs --name "lights" -- api/server.ts;
cd ~/Documents/website/modules/tools/plutus && pnpm run build && pm2 start ./node_modules/tsx/dist/cli.mjs --name "plutus" -- api/server.ts;
cd ~/Documents/website/modules/tools/journey && bun run build && pm2 start ./node_modules/tsx/dist/cli.mjs --name "journey" -- api/server.ts;
cd ~/Documents/website/modules/tools/smahunter && pnpm run build && pm2 start ./node_modules/tsx/dist/cli.mjs --name "smahunter" -- src/backend/app.ts;
cd ~/Documents/website/modules/auth && pm2 start npm --name "auth" -- run start;
cd ~/Documents/website/modules/bot && pm2 start npm --name "bot" -- run start;

pm2 save;