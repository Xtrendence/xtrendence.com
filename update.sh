git pull origin master;
git pull github master;

cd ~/Documents/tools/dns-updater && npm install;
cd ~/Documents/tools/stake-check && npm install;

cd ~/Documents/website/ && npm install;
cd ~/Documents/website/modules/tools/lights && npm install;
cd ~/Documents/website/modules/tools/plutus && pnpm install && pnpm run build;
cd ~/Documents/website/modules/auth && npm install;
cd ~/Documents/website/modules/bot && npm install;

sh ~/Documents/website/start.sh;