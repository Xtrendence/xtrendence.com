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

pm2 save;