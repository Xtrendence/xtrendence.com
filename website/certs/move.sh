sudo rm /home/pi/Documents/website/certs/fullchain.pem;
sudo rm /home/pi/Documents/website/certs/privkey.pem;
sudo rm /home/pi/Documents/website/certs/cert.pem;

sudo cp /etc/letsencrypt/live/xtrendence.com/fullchain.pem /home/pi/Documents/website/certs/fullchain.pem && chmod 755 /home/pi/Documents/website/certs/fullchain.pem;
sudo cp /etc/letsencrypt/live/xtrendence.com/privkey.pem /home/pi/Documents/website/certs/privkey.pem && chmod 755 /home/pi/Documents/website/certs/privkey.pem;
sudo cp /etc/letsencrypt/live/xtrendence.com/cert.pem /home/pi/Documents/website/certs/cert.pem && chmod 755 /home/pi/Documents/website/certs/cert.pem;