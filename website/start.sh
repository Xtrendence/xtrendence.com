pm2 stop xtrendence.com; 
pm2 stop auth; 
pm2 stop bot; 
pm2 stop lights; 
pm2 stop cryptoshare;
pm2 stop finances;
pm2 stop plutus;

pm2 delete xtrendence.com; 
pm2 delete auth; 
pm2 delete bot; 
pm2 delete lights;
pm2 delete cryptoshare;
pm2 delete finances;
pm2 delete plutus;

cd ~/Documents/website && pm2 start npm --name "xtrendence.com" -- run prod;
cd ~/Documents/website/modules/tools/lights && pm2 start npm --name "lights" -- run start;
cd ~/Documents/website/modules/tools/cryptoshare/api && pm2 start npm --name "cryptoshare" -- run start;
cd ~/Documents/website/modules/tools/finances && pm2 start npm --name "finances" -- run start;
cd ~/Documents/website/modules/tools/plutus && pnpm run build && pm2 start pnpm --name "plutus" -- run api;
cd ~/Documents/website/modules/auth && pm2 start npm --name "auth" -- run start;
cd ~/Documents/website/modules/bot && pm2 start npm --name "bot" -- run start;

pm2 save;