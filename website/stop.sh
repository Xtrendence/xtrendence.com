pm2 stop xtrendence.com; 
pm2 stop auth; 
pm2 stop bot; 
pm2 stop lights;
pm2 stop cryptoshare;
pm2 stop finances;

pm2 delete xtrendence.com;
pm2 delete auth;
pm2 delete bot;
pm2 delete lights;
pm2 delete cryptoshare;
pm2 delete finances;

pm2 save;