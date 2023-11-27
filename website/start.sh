pm2 stop xtrendence.com; 
pm2 delete xtrendence.com; 
pm2 start npm --name "xtrendence.com" -- run prod;