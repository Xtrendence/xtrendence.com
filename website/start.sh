pm2 stop xtrendence.com; 
pm2 stop auth; 
pm2 stop bot; 
pm2 stop lights;
pm2 stop plutus;
pm2 stop journey;

pm2 delete xtrendence.com; 
pm2 delete auth; 
pm2 delete bot; 
pm2 delete lights;
pm2 delete plutus;
pm2 delete journey;

cd ~/Documents/website && pm2 start npm --name "xtrendence.com" -- run prod;
cd ~/Documents/website/modules/tools/lights && bun run build && pm2 start bun --name "lights" -- run api;
cd ~/Documents/website/modules/tools/plutus && pnpm run build && pm2 start pnpm --name "plutus" -- run api;
cd ~/Documents/website/modules/tools/journey && bun run build && pm2 start bun --name "journey" -- run api;
cd ~/Documents/website/modules/auth && pm2 start npm --name "auth" -- run start;
cd ~/Documents/website/modules/bot && pm2 start npm --name "bot" -- run start;

pm2 save;