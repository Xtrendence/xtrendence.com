pm2 stop xtrendence.com; 
pm2 stop auth; 
pm2 stop stake-check; 
pm2 stop lights; 

pm2 delete xtrendence.com; 
pm2 delete auth; 
pm2 delete stake-check;
pm2 delete lights;

cd ~/Documents/website && pm2 start npm --name "xtrendence.com" -- run prod;
cd ~/Documents/tools/stake-check && pm2 start npm --name "stake-check" -- run start;
cd ~/Documents/website/modules/tools/lights && pm2 start npm --name "lights" -- run start;
cd ~/Documents/website/modules/auth && pm2 start npm --name "auth" -- run start;

pm2 save;