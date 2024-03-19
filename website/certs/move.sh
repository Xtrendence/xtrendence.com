sudo rm /home/xtrendence/Documents/website/certs/fullchain.pem;
sudo rm /home/xtrendence/Documents/website/certs/privkey.pem;
sudo rm /home/xtrendence/Documents/website/certs/cert.pem;

sudo cp /etc/letsencrypt/live/xtrendence.com-0001/fullchain.pem /home/xtrendence/Documents/website/certs/fullchain.pem && sudo chmod 755 /home/xtrendence/Documents/website/certs/fullchain.pem;
sudo cp /etc/letsencrypt/live/xtrendence.com-0001/privkey.pem /home/xtrendence/Documents/website/certs/privkey.pem && sudo chmod 755 /home/xtrendence/Documents/website/certs/privkey.pem;
sudo cp /etc/letsencrypt/live/xtrendence.com-0001/cert.pem /home/xtrendence/Documents/website/certs/cert.pem && sudo chmod 755 /home/xtrendence/Documents/website/certs/cert.pem;