pm2 stop xtrendence.com; 
pm2 stop auth; 
pm2 stop lights;

pm2 delete xtrendence.com;
pm2 delete auth;
pm2 delete lights;

pm2 save;